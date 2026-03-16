package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx               context.Context
	vpnProcess        *exec.Cmd
	mu                sync.Mutex
	connected         bool
	connectedAt       time.Time
	vpnInfo           VPNInfo
	trayStatusCh      chan string
	activeProfileName string
	activeProfileID   string   // for auto-reconnect
	manualDisconnect  bool     // true = user clicked disconnect, don't retry
	reconnectCancel   chan struct{} // close to cancel a pending reconnect
}

// Profile represents a saved VPN configuration
type Profile struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	OvpnPath string `json:"ovpnPath"` // path inside ~/.config/govpn/profiles/<id>/
	Username string `json:"username"`
	Password string `json:"password"`
}

type VPNInfo struct {
	VpnIP     string `json:"vpnIp"`
	PublicIP  string `json:"publicIp"`
	ServerIP  string `json:"serverIp"`
	Interface string `json:"interface"`
	Cipher    string `json:"cipher"`
	Gateway   string `json:"gateway"`
}

type TrafficStats struct {
	RxBytes uint64 `json:"rxBytes"`
	TxBytes uint64 `json:"txBytes"`
	RxHuman string `json:"rxHuman"`
	TxHuman string `json:"txHuman"`
	Uptime  string `json:"uptime"`
}

func NewApp() *App {
	return &App{
		trayStatusCh: make(chan string, 4),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.initTray()
}

// configDir returns ~/.config/govpn
func configDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "govpn")
}

func profilesPath() string {
	return filepath.Join(configDir(), "profiles.json")
}

func profileDir(id string) string {
	return filepath.Join(configDir(), "profiles", id)
}

// LoadProfiles returns all saved profiles
func (a *App) LoadProfiles() ([]Profile, error) {
	data, err := os.ReadFile(profilesPath())
	if err != nil {
		if os.IsNotExist(err) {
			return []Profile{}, nil
		}
		return nil, err
	}
	var profiles []Profile
	if err := json.Unmarshal(data, &profiles); err != nil {
		return nil, err
	}
	return profiles, nil
}

func saveProfiles(profiles []Profile) error {
	if err := os.MkdirAll(configDir(), 0700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(profiles, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(profilesPath(), data, 0600)
}

// ImportProfile copies the ovpn file into internal storage and saves the profile.
// After this succeeds the original file can be deleted.
func (a *App) ImportProfile(name, srcOvpnPath, username, password string) (*Profile, error) {
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(srcOvpnPath), ".ovpn")
	}

	// Generate a simple ID from name + timestamp
	id := fmt.Sprintf("%d", time.Now().UnixMilli())

	dir := profileDir(id)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create profile dir: %w", err)
	}

	// Copy the ovpn file into internal storage
	destPath := filepath.Join(dir, filepath.Base(srcOvpnPath))
	if err := copyFile(srcOvpnPath, destPath); err != nil {
		return nil, fmt.Errorf("failed to copy ovpn file: %w", err)
	}

	// Write auth file
	authPath := filepath.Join(dir, "auth.txt")
	if err := os.WriteFile(authPath, []byte(username+"\n"+password+"\n"), 0600); err != nil {
		return nil, err
	}

	profile := Profile{
		ID:       id,
		Name:     name,
		OvpnPath: destPath,
		Username: username,
		Password: password,
	}

	profiles, _ := a.LoadProfiles()
	profiles = append(profiles, profile)
	if err := saveProfiles(profiles); err != nil {
		return nil, err
	}

	return &profile, nil
}

// UpdateProfile saves updated credentials for an existing profile
func (a *App) UpdateProfile(id, name, username, password string) error {
	profiles, err := a.LoadProfiles()
	if err != nil {
		return err
	}
	for i, p := range profiles {
		if p.ID == id {
			profiles[i].Name = name
			profiles[i].Username = username
			profiles[i].Password = password
			// Update auth file
			authPath := filepath.Join(profileDir(id), "auth.txt")
			os.WriteFile(authPath, []byte(username+"\n"+password+"\n"), 0600)
			return saveProfiles(profiles)
		}
	}
	return fmt.Errorf("profile not found")
}

// DeleteProfile removes a profile and its stored files
func (a *App) DeleteProfile(id string) error {
	profiles, err := a.LoadProfiles()
	if err != nil {
		return err
	}
	filtered := profiles[:0]
	for _, p := range profiles {
		if p.ID != id {
			filtered = append(filtered, p)
		}
	}
	os.RemoveAll(profileDir(id))
	return saveProfiles(filtered)
}

// PickOvpnFile opens a native file dialog
func (a *App) PickOvpnFile() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select .ovpn file",
		Filters: []runtime.FileFilter{
			{DisplayName: "OpenVPN Config (*.ovpn)", Pattern: "*.ovpn"},
		},
	})
	return path, err
}

// GetPublicIP fetches the current public IP
func (a *App) GetPublicIP() string {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://api.ipify.org")
	if err != nil {
		return "unavailable"
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return strings.TrimSpace(string(body))
}

// GetTrafficStats reads bytes from /proc/net/dev for the tun interface
func (a *App) GetTrafficStats() TrafficStats {
	a.mu.Lock()
	iface := a.vpnInfo.Interface
	connAt := a.connectedAt
	a.mu.Unlock()

	stats := TrafficStats{Uptime: formatDuration(time.Since(connAt))}
	if iface == "" {
		return stats
	}
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return stats
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, iface+":") {
			continue
		}
		line = strings.TrimPrefix(line, iface+":")
		fields := strings.Fields(line)
		if len(fields) >= 9 {
			rx, _ := strconv.ParseUint(fields[0], 10, 64)
			tx, _ := strconv.ParseUint(fields[8], 10, 64)
			stats.RxBytes = rx
			stats.TxBytes = tx
			stats.RxHuman = humanBytes(rx)
			stats.TxHuman = humanBytes(tx)
		}
		break
	}
	return stats
}

func (a *App) GetVPNInfo() VPNInfo {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.vpnInfo
}

// cleanupStaleRoutes flushes leftover tun interfaces in a single sudo call
func cleanupStaleRoutes(logFn func(string)) {
	out, err := exec.Command("ip", "link", "show").Output()
	if err != nil {
		return
	}
	tunRe := regexp.MustCompile(`\d+:\s+(tun\d+):`)
	matches := tunRe.FindAllStringSubmatch(string(out), -1)
	if len(matches) == 0 {
		return
	}
	var cmds []string
	for _, match := range matches {
		iface := match[1]
		logFn("Removing stale interface: " + iface)
		cmds = append(cmds,
			fmt.Sprintf("ip route flush dev %s 2>/dev/null || true", iface),
			fmt.Sprintf("ip link set %s down 2>/dev/null || true", iface),
			fmt.Sprintf("ip link delete %s 2>/dev/null || true", iface),
		)
	}
	if err := exec.Command("sudo", "bash", "-c", strings.Join(cmds, "; ")).Run(); err != nil {
		logFn("Cleanup warning: " + err.Error())
	}
}

// ConnectProfile connects using a saved profile by ID
func (a *App) ConnectProfile(profileID string) error {
	profiles, err := a.LoadProfiles()
	if err != nil {
		return err
	}
	for _, p := range profiles {
		if p.ID == profileID {
			a.mu.Lock()
			a.activeProfileName = p.Name
			a.activeProfileID   = p.ID
			a.manualDisconnect  = false
			a.mu.Unlock()
			return a.connect(p.OvpnPath, p.Username, p.Password)
		}
	}
	return fmt.Errorf("profile not found")
}

func (a *App) connect(ovpnPath, username, password string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.connected {
		return fmt.Errorf("already connected")
	}

	runtime.EventsEmit(a.ctx, "vpn:log", "Cleaning up stale routes...")
	cleanupStaleRoutes(func(msg string) {
		runtime.EventsEmit(a.ctx, "vpn:log", msg)
	})

	authPath := filepath.Join(filepath.Dir(ovpnPath), "auth.txt")
	if err := os.WriteFile(authPath, []byte(username+"\n"+password+"\n"), 0600); err != nil {
		return fmt.Errorf("failed to write auth file: %w", err)
	}

	a.vpnProcess = exec.Command("sudo", "openvpn",
		"--config", ovpnPath,
		"--auth-user-pass", authPath,
		"--verb", "3",
	)

	stdout, err := a.vpnProcess.StdoutPipe()
	if err != nil {
		return err
	}
	a.vpnProcess.Stderr = a.vpnProcess.Stdout

	if err := a.vpnProcess.Start(); err != nil {
		return fmt.Errorf("failed to start openvpn: %w", err)
	}

	a.connected = true
	a.vpnInfo = VPNInfo{}
	runtime.EventsEmit(a.ctx, "vpn:status", "connecting")
	a.trayStatusCh <- "connecting"

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			runtime.EventsEmit(a.ctx, "vpn:log", line)
			a.parseLine(line)
		}
		a.mu.Lock()
		connectedAt    := a.connectedAt
		profileName    := a.activeProfileName
		profileID      := a.activeProfileID
		vpnIP          := a.vpnInfo.VpnIP
		serverIP       := a.vpnInfo.ServerIP
		wasManual      := a.manualDisconnect
		a.connected    = false
		a.vpnProcess   = nil
		a.mu.Unlock()

		// Write audit entry
		if !connectedAt.IsZero() {
			duration := time.Since(connectedAt)
			a.appendAuditEntry(AuditEntry{
				ID:          fmt.Sprintf("%d", connectedAt.UnixMilli()),
				ProfileName: profileName,
				ConnectedAt: connectedAt.Format("2 Jan 2006 15:04:05"),
				Duration:    formatDuration(duration),
				VpnIP:       vpnIP,
				ServerIP:    serverIP,
			})
		}

		runtime.EventsEmit(a.ctx, "vpn:status", "disconnected")
		a.trayStatusCh <- "disconnected"

		// Auto-reconnect only on unexpected drops
		if !wasManual && profileID != "" {
			a.startReconnectLoop(profileID)
		}
	}()

	return nil
}

func (a *App) parseLine(line string) {
	a.mu.Lock()
	defer a.mu.Unlock()

	if m := regexp.MustCompile(`ifconfig\s+([\d.]+)\s+([\d.]+)`).FindStringSubmatch(line); m != nil {
		a.vpnInfo.VpnIP = m[1]
	}
	if m := regexp.MustCompile(`route-gateway\s+([\d.]+)`).FindStringSubmatch(line); m != nil {
		a.vpnInfo.Gateway = m[1]
	}
	if m := regexp.MustCompile(`cipher\s+'?([A-Z0-9\-]+)'?`).FindStringSubmatch(line); m != nil {
		a.vpnInfo.Cipher = m[1]
	}
	if m := regexp.MustCompile(`TCP connection established with \[AF_INET\]([\d.]+):(\d+)`).FindStringSubmatch(line); m != nil {
		a.vpnInfo.ServerIP = m[1] + ":" + m[2]
	}
	if m := regexp.MustCompile(`TUN/TAP device\s+(\S+)\s+opened`).FindStringSubmatch(line); m != nil {
		a.vpnInfo.Interface = m[1]
	}
	if strings.Contains(line, "Initialization Sequence Completed") {
		a.connectedAt = time.Now()
		go func() {
			ip := a.GetPublicIP()
			a.mu.Lock()
			a.vpnInfo.PublicIP = ip
			a.mu.Unlock()
			runtime.EventsEmit(a.ctx, "vpn:info", a.vpnInfo)
		}()
		runtime.EventsEmit(a.ctx, "vpn:status", "connected")
		runtime.EventsEmit(a.ctx, "vpn:info", a.vpnInfo)
		a.trayStatusCh <- "connected"
	}
}

func (a *App) Disconnect() error {
	a.mu.Lock()

	if a.vpnProcess == nil {
		// Cancel any pending reconnect even if not currently connected
		if a.reconnectCancel != nil {
			close(a.reconnectCancel)
			a.reconnectCancel = nil
		}
		a.mu.Unlock()
		return fmt.Errorf("not connected")
	}

	a.manualDisconnect = true
	if a.reconnectCancel != nil {
		close(a.reconnectCancel)
		a.reconnectCancel = nil
	}
	a.mu.Unlock()

	a.mu.Lock()
	proc := a.vpnProcess
	a.mu.Unlock()

	proc.Process.Signal(os.Interrupt)
	done := make(chan struct{})
	go func() {
		proc.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		proc.Process.Kill()
	}

	a.mu.Lock()
	a.connected = false
	a.vpnProcess = nil
	a.vpnInfo = VPNInfo{}
	a.mu.Unlock()
	runtime.EventsEmit(a.ctx, "vpn:status", "disconnected")
	a.trayStatusCh <- "disconnected"
	return nil
}

func (a *App) IsConnected() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.connected
}

// startReconnectLoop retries connecting with exponential backoff (5 attempts max)
func (a *App) startReconnectLoop(profileID string) {
	cancel := make(chan struct{})
	a.mu.Lock()
	a.reconnectCancel = cancel
	a.mu.Unlock()

	go func() {
		delays := []time.Duration{5, 10, 20, 40, 60}
		for attempt, delay := range delays {
			// Emit reconnecting status with countdown
			msg := fmt.Sprintf("Reconnecting in %ds (attempt %d/%d)...", int(delay.Seconds()), attempt+1, len(delays))
			runtime.EventsEmit(a.ctx, "vpn:log", msg)
			runtime.EventsEmit(a.ctx, "vpn:status", "reconnecting")
			runtime.EventsEmit(a.ctx, "vpn:reconnect", map[string]interface{}{
				"attempt": attempt + 1,
				"total":   len(delays),
				"delay":   int(delay.Seconds()),
			})

			// Wait with cancellation support
			select {
			case <-cancel:
				runtime.EventsEmit(a.ctx, "vpn:log", "Reconnect cancelled.")
				return
			case <-time.After(delay * time.Second):
			}

			// Check if manually cancelled during wait
			a.mu.Lock()
			isManual := a.manualDisconnect
			a.mu.Unlock()
			if isManual {
				return
			}

			runtime.EventsEmit(a.ctx, "vpn:log", fmt.Sprintf("Reconnect attempt %d/%d...", attempt+1, len(delays)))
			if err := a.ConnectProfile(profileID); err == nil {
				// Success — loop will exit naturally when connected
				a.mu.Lock()
				a.reconnectCancel = nil
				a.mu.Unlock()
				return
			}
		}
		runtime.EventsEmit(a.ctx, "vpn:log", "Auto-reconnect failed after 5 attempts.")
		runtime.EventsEmit(a.ctx, "vpn:status", "disconnected")
		a.trayStatusCh <- "disconnected"
	}()
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func humanBytes(b uint64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := uint64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

func formatDuration(d time.Duration) string {
	d = d.Round(time.Second)
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60
	if h > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}

// ── Update / Changelog ──────────────────────────────────────────────────────

// UpdateInfo holds the result of a GitHub update check
type UpdateInfo struct {
	HasUpdate   bool   `json:"hasUpdate"`
	LatestTag   string `json:"latestTag"`
	CurrentTag  string `json:"currentTag"`
	ReleaseURL  string `json:"releaseUrl"`
	ReleaseBody string `json:"releaseBody"`
}

// AppConfig persists lightweight app state between launches
type AppConfig struct {
	LastSeenVersion string `json:"lastSeenVersion"`
}

func appConfigPath() string {
	return filepath.Join(configDir(), "config.json")
}

func loadAppConfig() AppConfig {
	data, err := os.ReadFile(appConfigPath())
	if err != nil {
		return AppConfig{}
	}
	var cfg AppConfig
	json.Unmarshal(data, &cfg)
	return cfg
}

func saveAppConfig(cfg AppConfig) {
	os.MkdirAll(configDir(), 0700)
	data, _ := json.MarshalIndent(cfg, "", "  ")
	os.WriteFile(appConfigPath(), data, 0600)
}

// GetCurrentVersion returns the build-time version string
func (a *App) GetCurrentVersion() string {
	return version
}

// CheckForUpdate hits the GitHub releases API and returns update info
func (a *App) CheckForUpdate() UpdateInfo {
	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", "https://api.github.com/repos/h200137j/VPN/releases/latest", nil)
	if err != nil {
		return UpdateInfo{CurrentTag: version}
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		return UpdateInfo{CurrentTag: version}
	}
	defer resp.Body.Close()

	var release struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
		Body    string `json:"body"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return UpdateInfo{CurrentTag: version}
	}

	return UpdateInfo{
		HasUpdate:   release.TagName != version && version != "dev",
		LatestTag:   release.TagName,
		CurrentTag:  version,
		ReleaseURL:  release.HTMLURL,
		ReleaseBody: release.Body,
	}
}

// CheckChangelog returns release notes if this is the first boot on a new version
func (a *App) CheckChangelog() string {
	if version == "dev" {
		return ""
	}
	cfg := loadAppConfig()
	if cfg.LastSeenVersion == version {
		return ""
	}
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get("https://api.github.com/repos/h200137j/VPN/releases/tags/" + version)
	if err != nil || resp.StatusCode != 200 {
		cfg.LastSeenVersion = version
		saveAppConfig(cfg)
		return ""
	}
	defer resp.Body.Close()
	var release struct {
		Body string `json:"body"`
	}
	json.NewDecoder(resp.Body).Decode(&release)
	cfg.LastSeenVersion = version
	saveAppConfig(cfg)
	return release.Body
}
