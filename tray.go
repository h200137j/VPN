package main

import (
	_ "embed"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/trayicon.png
var trayIcon []byte

func (a *App) initTray() {
	go systray.Run(a.onTrayReady, nil)
}

func (a *App) onTrayReady() {
	systray.SetIcon(trayIcon)
	systray.SetTitle("GoVPN")
	systray.SetTooltip("GoVPN — Disconnected")

	mShow := systray.AddMenuItem("Show Window", "Bring GoVPN to front")
	systray.AddSeparator()
	mStatus := systray.AddMenuItem("Status: Disconnected", "")
	mStatus.Disable()
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Exit GoVPN")

	// Listen for VPN status changes to update tray tooltip/status
	go func() {
		for {
			select {
			case <-mShow.ClickedCh:
				runtime.WindowShow(a.ctx)
			case <-mQuit.ClickedCh:
				systray.Quit()
				runtime.Quit(a.ctx)
				return
			case status := <-a.trayStatusCh:
				switch status {
				case "connected":
					systray.SetTooltip("GoVPN — Connected")
					mStatus.SetTitle("Status: Connected ✓")
				case "connecting":
					systray.SetTooltip("GoVPN — Connecting...")
					mStatus.SetTitle("Status: Connecting...")
				case "disconnected":
					systray.SetTooltip("GoVPN — Disconnected")
					mStatus.SetTitle("Status: Disconnected")
				}
			}
		}
	}()
}
