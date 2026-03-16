<div align="center">

# 🛡️ GoVPN

### A lightweight OpenVPN client for Linux — built with Go & Wails

[![Latest Release](https://img.shields.io/github/v/release/h200137j/VPN?style=flat-square&color=5b8dee&label=latest)](https://github.com/h200137j/VPN/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/h200137j/VPN/total?style=flat-square&color=3ecf8e)](https://github.com/h200137j/VPN/releases)
![Go](https://img.shields.io/badge/Go-1.23+-00ADD8?style=flat-square&logo=go&logoColor=white)
![Wails](https://img.shields.io/badge/Wails-v2-red?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Linux-FCC624?style=flat-square&logo=linux&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</div>

---

## 📦 Install

### Option 1 — .deb package (recommended)

Download the latest `.deb` from the [Releases page](https://github.com/h200137j/VPN/releases/latest) and install:

```bash
sudo dpkg -i govpn_*_amd64.deb
sudo apt-get install -f
```

### Option 2 — Raw binary

```bash
# Download and make executable
chmod +x govpn
./govpn
```

---

## ✨ Features

- **Multiple profiles** — save as many VPN configs as you need, each with their own credentials
- **Import & forget** — the app copies your `.ovpn` file into internal storage, so you can delete the original
- **Live connection stats** — VPN IP, public IP, server, cipher, interface, bytes sent/received
- **Connection timer** — see exactly how long you've been connected
- **System tray** — minimize to tray and keep the VPN running in the background
- **Stale route cleanup** — automatically flushes leftover `tun` interfaces on reconnect, fixing the classic "connected but no traffic" Linux bug
- **Graceful disconnect** — sends `SIGTERM` so OpenVPN cleans up its own routes properly
- **Beautiful dark UI** — animated shield, gradient buttons, smooth panel transitions
- **Live log stream** — color-coded OpenVPN output in real time

---

## 🚀 Build from Source

### Prerequisites

| Dependency | Install |
|---|---|
| Go 1.23+ | [go.dev](https://go.dev/dl/) |
| Wails v2 | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| OpenVPN | `sudo apt install openvpn` |
| WebKit2GTK | `sudo apt install libwebkit2gtk-4.1-dev` |
| AppIndicator | `sudo apt install libayatana-appindicator3-dev` |
| Node.js + npm | [nodejs.org](https://nodejs.org) |

```bash
git clone https://github.com/h200137j/VPN.git
cd VPN
wails build -tags webkit2_41
./build/bin/vpn
```

### Dev mode (hot reload)

```bash
wails dev -tags webkit2_41
```

---

## 🔧 How It Works

GoVPN uses Go for all system-level operations and a Vanilla JS + Vite frontend rendered in a WebKit2GTK webview via Wails.

```
┌─────────────────────────────────────┐
│           Wails App Window          │
│  ┌───────────────┐  ┌────────────┐  │
│  │  Frontend     │  │ Go Backend │  │
│  │  Vanilla JS   │◄─►  app.go   │  │
│  │  + CSS        │  │            │  │
│  └───────────────┘  └─────┬──────┘  │
└────────────────────────────┼────────┘
                             │ sudo
                      ┌──────▼──────┐
                      │   openvpn   │
                      └─────────────┘
```

Profiles are stored in `~/.config/govpn/` with permissions `0700`/`0600`. Credentials are never stored in plain text outside that directory.

---

## 📁 Profile Storage

When you import a profile, the `.ovpn` file is copied to:

```
~/.config/govpn/
├── profiles.json
└── profiles/
    └── <id>/
        ├── config.ovpn    # your imported config (original can be deleted)
        └── auth.txt       # credentials (mode 0600)
```

---

## ⚙️ Sudoers Setup

GoVPN uses `sudo` to run `openvpn` and clean up stale routes. To avoid password prompts, add this to your sudoers file (`sudo visudo`):

```
youruser ALL=(ALL) NOPASSWD: /usr/sbin/openvpn, /usr/sbin/ip, /bin/bash
```

---

## 🛠️ Tech Stack

- **[Go](https://go.dev)** — backend, process management, file I/O
- **[Wails v2](https://wails.io)** — bridges Go and the web frontend
- **[Vite](https://vitejs.dev)** — frontend build tool
- **Vanilla JS + CSS** — no framework, clean modern CSS with animations
- **[OpenVPN](https://openvpn.net)** — the underlying VPN engine
- **[fyne.io/systray](https://github.com/fyne-io/systray)** — system tray support

---

## 📄 License

MIT © 2026 calvin
