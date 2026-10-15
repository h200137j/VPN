//go:build darwin

package main

import "github.com/wailsapp/wails/v2/pkg/runtime"

// initTray: fyne.io/systray replaces the NSApplication delegate and runs its own
// [NSApp run] loop, which conflicts with Wails on macOS. Instead, reflect the
// VPN status in the window title and keep trayStatusCh drained.
func (a *App) initTray() {
	go func() {
		for status := range a.trayStatusCh {
			switch status {
			case "connected":
				runtime.WindowSetTitle(a.ctx, "GoVPN — Connected")
			case "connecting":
				runtime.WindowSetTitle(a.ctx, "GoVPN — Connecting...")
			case "disconnected":
				runtime.WindowSetTitle(a.ctx, "GoVPN")
			}
		}
	}()
}
