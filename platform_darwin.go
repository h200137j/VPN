//go:build darwin

package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// hideWindowOnClose is false on macOS: there is no tray icon to bring a hidden
// window back, so closing the window quits the app (and disconnects).
const hideWindowOnClose = false

// appMenu returns the native macOS menu bar. The Edit menu is required for
// Cmd+C / Cmd+V / Cmd+A to work in the webview's text inputs.
func appMenu() *menu.Menu {
	m := menu.NewMenu()
	m.Append(menu.AppMenu())
	m.Append(menu.EditMenu())
	m.Append(menu.WindowMenu())
	return m
}

// hideOnStartup minimises to the Dock (a hidden window could not be restored)
func hideOnStartup(ctx context.Context) {
	runtime.WindowMinimise(ctx)
}

// openvpnBinary returns the absolute path of openvpn. Apps launched from Finder
// get a minimal PATH and sudo's secure_path excludes Homebrew, so look in the
// usual install locations first.
func openvpnBinary() string {
	for _, p := range []string{
		"/opt/homebrew/sbin/openvpn", // Homebrew (Apple Silicon)
		"/usr/local/sbin/openvpn",    // Homebrew (Intel)
		"/opt/local/sbin/openvpn",    // MacPorts
	} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("openvpn"); err == nil {
		return p
	}
	return "openvpn"
}

// outboundIP returns the local address the OS would use to reach the internet.
// Dialing UDP sends no packets; it only resolves the route.
func outboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()
	if addr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
		return addr.IP.String()
	}
	return ""
}

// interfaceBytes reads rx/tx byte counters from `netstat -ibn`
func interfaceBytes(iface string) (rx, tx uint64, ok bool) {
	out, err := exec.Command("netstat", "-ibn", "-I", iface).Output()
	if err != nil {
		return 0, 0, false
	}
	// Columns: Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
	// Address is empty for utun links, so index from the end of the row.
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 10 || fields[0] != iface || !strings.HasPrefix(fields[2], "<Link") {
			continue
		}
		n := len(fields)
		rx, err1 := strconv.ParseUint(fields[n-5], 10, 64)
		tx, err2 := strconv.ParseUint(fields[n-2], 10, 64)
		return rx, tx, err1 == nil && err2 == nil
	}
	return 0, 0, false
}

// interfaceUp reports whether the utun interface still exists and is UP
func interfaceUp(iface string) bool {
	ifi, err := net.InterfaceByName(iface)
	return err == nil && ifi.Flags&net.FlagUp != 0
}

// pingArgs returns ping arguments: 4 packets, 3 second reply timeout
// (macOS ping takes -W in milliseconds)
func pingArgs(host string) []string {
	return []string{"-c", "4", "-W", "3000", host}
}

// cleanupStaleRoutes is a no-op on macOS: utun devices are destroyed by the
// kernel as soon as the owning openvpn process exits.
func cleanupStaleRoutes(logFn func(string)) {}

const launchAgentLabel = "io.github.h200137j.govpn"

// setAutostart writes or removes ~/Library/LaunchAgents/<label>.plist
func setAutostart(enable bool, startMinimized bool) error {
	home, _ := os.UserHomeDir()
	agentsDir := filepath.Join(home, "Library", "LaunchAgents")
	plistFile := filepath.Join(agentsDir, launchAgentLabel+".plist")

	if !enable {
		os.Remove(plistFile)
		return nil
	}

	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("could not determine executable path: %w", err)
	}

	if err := os.MkdirAll(agentsDir, 0755); err != nil {
		return err
	}

	// startMinimized is honoured by the app itself via config.json
	content := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>%s</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
`, launchAgentLabel, exe)

	return os.WriteFile(plistFile, []byte(content), 0644)
}
