# GoVPN — Feature Roadmap

---

## Quality of Life

- [x] **Auto-reconnect** — automatically retry on connection drop, with configurable retry count and exponential backoff. Show retry status in the UI.
- [ ] **Pinned profiles** — mark a profile as favourite so it always appears at the top of the list and is pre-selected on launch.
- [ ] **QR code import** — import a VPN profile by scanning a QR code generated from another device. Useful for quick setup on a new machine.
- [ ] **Theme toggle** — switch between dark and light mode. Persist the preference.
- [ ] **Launch on login** — option to start GoVPN automatically on login by writing a `.desktop` file to `~/.config/autostart`.

---

## Network Intelligence

- [x] **Pre-connect ping** — ping the VPN server before connecting and display latency so you know the connection quality upfront.
- [x] **Built-in speed test** — run a download/upload speed test through the active tunnel and display results in the info panel.
- [ ] **DNS leak test** — verify that DNS queries are routing through the VPN and not leaking to the ISP. Show a pass/fail result with details.
- [ ] **Kill switch** — block all internet traffic via `iptables` if the VPN connection drops unexpectedly. Restore rules on reconnect or app exit.
- [ ] **Split tunneling** — configure which apps or IP ranges bypass the VPN and go direct, while everything else routes through the tunnel.

---

## Security

- [ ] **Credential vault** — encrypt stored passwords with AES-256 behind a master password so credentials are never plain text on disk.
- [ ] **Auto-lock** — after a configurable period of inactivity, lock the vault and require the master password before reconnecting.
- [x] **Connection audit log** — maintain a timestamped history of every connect and disconnect event, including session duration and profile used.
- [x] **Certificate expiry warnings** — parse the certificate embedded in the `.ovpn` file and show a warning in the UI when it is close to expiring.

---

## Wild Ideas

- [ ] **Network map** — a live animated visual showing the path: your device → VPN server → destination, with packets flowing through it in real time.
- [ ] **Geo-awareness** — display a world map with a pin on the VPN server location and your apparent public location, updated on each connect.
- [ ] **Scheduled connections** — set a schedule per profile, e.g. "connect every weekday at 08:00, disconnect at 18:00". Runs silently in the tray.
- [ ] **Multi-hop** — chain two VPN profiles so traffic goes through two servers before reaching the internet. Double the encryption, double the fun.
- [ ] **Bandwidth budget** — set a monthly data cap per profile. Track usage and show a warning when approaching the limit.
- [ ] **Threat feed integration** — pull a blocklist of known malicious IPs and automatically null-route them while connected, adding a layer of protection on top of the VPN.
