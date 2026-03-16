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
	ctx         context.Context
	vpnProcess  *exec.Cmd
	mu          sync.Mutex
	connected   bool
	connectedAt time.Time
	vpnInfo     VPNInfo
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

func NewApp() *App { return &App{} }

func (a *App) startup(ctx context.Context) { a.ctx = ctx }

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

	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			runtime.EventsEmit(a.ctx, "vpn:log", line)
			a.parseLine(line)
		}
		a.mu.Lock()
		a.connected = false
		a.vpnProcess = nil
		a.mu.Unlock()
		runtime.EventsEmit(a.ctx, "vpn:status", "disconnected")
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
	}
}

func (a *App) Disconnect() error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.vpnProcess == nil {
		return fmt.Errorf("not connected")
	}

	a.vpnProcess.Process.Signal(os.Interrupt)
	done := make(chan struct{})
	go func() {
		a.vpnProcess.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		a.vpnProcess.Process.Kill()
	}

	a.connected = false
	a.vpnProcess = nil
	a.vpnInfo = VPNInfo{}
	runtime.EventsEmit(a.ctx, "vpn:status", "disconnected")
	return nil
}

func (a *App) IsConnected() bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.connected
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
