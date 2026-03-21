import { useReducer, useEffect, useRef, useState } from 'react';

function formatUptime(startMs) {
  if (!startMs) return '00:00';
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

const TILES = [
  { icon: '🌐', label: 'Public IP',   key: 'publicIp',  stat: false },
  { icon: '🖥',  label: 'VPN Server',  key: 'serverIp',  stat: false },
  { icon: '🔌', label: 'Interface',   key: 'interface', stat: false },
  { icon: '🔒', label: 'Cipher',      key: 'cipher',    stat: false },
  { icon: '⬇',  label: 'Downloaded',  key: 'rxHuman',   stat: true  },
  { icon: '⬆',  label: 'Uploaded',    key: 'txHuman',   stat: true  },
];

// Rotating status messages shown while connecting
const CONNECTING_MSGS = [
  'Establishing secure tunnel...',
  'Authenticating credentials...',
  'Negotiating encryption...',
  'Configuring routes...',
  'Almost there...',
];

function ConnectingScreen({ status }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const label = status === 'reconnecting' ? 'Reconnecting' : 'Connecting';

  useEffect(() => {
    const t = setInterval(() => {
      setMsgIdx(i => (i + 1) % CONNECTING_MSGS.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="conn-waiting">
      {/* Orbital rings */}
      <div className="conn-orbit-wrap">
        <div className="conn-orbit o1" />
        <div className="conn-orbit o2" />
        <div className="conn-orbit o3" />
        {/* Orbiting dots */}
        <div className="conn-dot-track t1"><div className="conn-dot-orb" /></div>
        <div className="conn-dot-track t2"><div className="conn-dot-orb orb2" /></div>
        {/* Center shield */}
        <div className="conn-shield-center">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"/>
          </svg>
        </div>
      </div>

      <div className="conn-waiting-label">{label}</div>
      <div className="conn-waiting-msg" key={msgIdx}>{CONNECTING_MSGS[msgIdx]}</div>

      {/* Scanning line */}
      <div className="conn-scan-bar">
        <div className="conn-scan-fill" />
      </div>
    </div>
  );
}

function LogBox({ logs, onClear }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="log-wrap">
      <div className="log-header">
        <span>Connection Log</span>
        <button className="btn-clear" onClick={onClear}>Clear</button>
      </div>
      <div className="log-box" ref={boxRef}>
        {logs.length === 0
          ? <p className="info">No log entries yet.</p>
          : logs.map(l => <p key={l.id} className={l.type}>{l.msg}</p>)
        }
      </div>
    </div>
  );
}

export default function ConnectionTab({ vpn }) {
  const isConnected    = vpn.status === 'connected';
  const isConnecting   = vpn.status === 'connecting' || vpn.status === 'reconnecting';
  const isDisconnected = vpn.status === 'disconnected';
  const [, tick] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  return (
    <div className="tab-content">
      {isConnecting && <ConnectingScreen status={vpn.status} />}

      {isConnected && (
        <div className="info-panel">
          <div className="info-hero">
            <div className="info-hero-ip">{vpn.vpnInfo.vpnIp || '—'}</div>
            <div className="info-hero-label">VPN IP Address</div>
            <div className="uptime-badge">{formatUptime(vpn.connectedAt)}</div>
          </div>
          <div className="info-grid">
            {TILES.map(({ icon, label, key, stat }) => (
              <div className="info-tile" key={label}>
                <div className="info-tile-icon">{icon}</div>
                <div className="info-tile-body">
                  <div className="info-tile-label">{label}</div>
                  <div className="info-tile-value">
                    {(stat ? vpn.trafficStats[key] : vpn.vpnInfo[key]) || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isDisconnected && (
        <div className="disconnected-hint">
          <div className="hint-icon">🛡</div>
          <div className="hint-text">Not connected</div>
          <div className="hint-sub">Select a profile and hit Connect to get started</div>
        </div>
      )}

      <LogBox logs={vpn.logs} onClear={() => vpn.setLogs([])} />
    </div>
  );
}
