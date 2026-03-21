import { useReducer, useEffect, useRef } from 'react';

function formatUptime(startMs) {
  if (!startMs) return '00:00';
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

const TILES = [
  { icon: '🌐', label: 'Public IP',  key: 'publicIp',  stat: false },
  { icon: '🖥',  label: 'VPN Server', key: 'serverIp',  stat: false },
  { icon: '🔌', label: 'Interface',  key: 'interface', stat: false },
  { icon: '🔒', label: 'Cipher',     key: 'cipher',    stat: false },
  { icon: '⬇',  label: 'Downloaded', key: 'rxHuman',   stat: true  },
  { icon: '⬆',  label: 'Uploaded',   key: 'txHuman',   stat: true  },
];

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
  const isConnected = vpn.status === 'connected';
  const [, tick] = useReducer(x => x + 1, 0);

  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  return (
    <div className="tab-content">
      {isConnected ? (
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
      ) : (
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
