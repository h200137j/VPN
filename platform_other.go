//go:build !darwin

package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// hideWindowOnClose keeps the app running in the tray when the window is closed
const hideWindowOnClose = true

// appMenu returns the native application menu (none needed here)
func appMenu() *menu.Menu {
	return nil
}

// hideOnStartup hides the window to the tray
func hideOnStartup(ctx context.Context) {
	runtime.WindowHide(ctx)
}

// openvpnBinary returns the openvpn executable; sudo resolves it via secure_path
func openvpnBinary() string {
	return "openvpn"
}

// outboundIP returns the source IP of the default route, or "" if unknown
func outboundIP() string {
	// Use 'ip route get' — fastest way to find the outbound interface IP
	out, err := exec.Command("ip", "route", "get", "8.8.8.8").Output()
	if err != nil {
		return ""
	}
	// Output: "8.8.8.8 via 192.168.1.1 dev wlp0s20f3 src 192.168.1.100 ..."
	if m := regexp.MustCompile(`src\s+([\d.]+)`).FindStringSubmatch(string(out)); m != nil {
		return m[1]
	}
	return ""
}

// interfaceBytes reads rx/tx byte counters from /proc/net/dev
func interfaceBytes(iface string) (rx, tx uint64, ok bool) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0, false
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, iface+":") {
			continue
		}
		fields := strings.Fields(strings.TrimPrefix(line, iface+":"))
		if len(fields) < 9 {
			return 0, 0, false
		}
		rx, _ = strconv.ParseUint(fields[0], 10, 64)
		tx, _ = strconv.ParseUint(fields[8], 10, 64)
		return rx, tx, true
	}
	return 0, 0, false
}

// interfaceUp reports whether the tun interface still exists and is UP
func interfaceUp(iface string) bool {
	out, err := exec.Command("ip", "link", "show", iface).Output()
	return err == nil && (strings.Contains(string(out), " UP") || strings.Contains(string(out), ",UP"))
}

// pingArgs returns ping arguments: 4 packets, 3 second reply timeout
func pingArgs(host string) []string {
	return []string{"-c", "4", "-W", "3", host}
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

// setAutostart writes or removes the ~/.config/autostart/govpn.desktop file
func setAutostart(enable bool, startMinimized bool) error {
	home, _ := os.UserHomeDir()
	autostartDir := filepath.Join(home, ".config", "autostart")
	desktopFile := filepath.Join(autostartDir, "govpn.desktop")

	if !enable {
		os.Remove(desktopFile)
		return nil
	}

	// Find our own executable path
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not determine executable path: %w", err)
	}

	if err := os.MkdirAll(autostartDir, 0755); err != nil {
		return err
	}

	hidden := "false"
	if startMinimized {
		hidden = "true"
	}

	content := fmt.Sprintf(`[Desktop Entry]
Type=Application
Name=GoVPN
Comment=Lightweight OpenVPN client
Exec=%s
Icon=govpn
Terminal=false
Hidden=%s
X-GNOME-Autostart-enabled=true
`, exe, hidden)

	return os.WriteFile(desktopFile, []byte(content), 0644)
}
