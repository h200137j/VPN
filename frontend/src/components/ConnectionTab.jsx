import React, { useMemo } from 'react';

function formatUptime(startMs) {
  if (!startMs) return '00:00';
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function LogBox({ logs, onClear }) {
  return (
    <div className="log-wrap">
      <div className="log-header">
        <span>Connection Log</span>
        <button className="btn-clear" onClick={onClear}>Clear</button>
      </div>
      <div className="log-box">
        {logs.map(l => <p key={l.id} className={l.type}>{l.msg}</p>)}
      </div>
    </div>
  );
}

export default function ConnectionTab({ vpn }) {
  const isConnected = vpn.status === 'connected';
  const uptime = formatUptime(vpn.connectedAt);

  // Re-render every second for uptime
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(forceUpdate, 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  return (
    <div className="tab-content">
      {isConnected ? (
        <div className="info-panel visible">
          <div className="info-hero">
            <div className="info-hero-ip">{vpn.vpnInfo.vpnIp || '—'}</div>
            <div className="info-hero-label">VPN IP Address</div>
            <div className="uptime-badge">{uptime}</div>
          </div>
          <div className="info-grid">
            {[
              { icon: '🌐', label: 'Public IP',   value: vpn.vpnInfo.publicIp },
              { icon: '🖥',  label: 'VPN Server',  value: vpn.vpnInfo.serverIp },
              { icon: '🔌', label: 'Interface',   value: vpn.vpnInfo.interface },
              { icon: '🔒', label: 'Cipher',      value: vpn.vpnInfo.cipher },
              { icon: '⬇',  label: 'Downloaded',  value: vpn.trafficStats.rxHuman },
              { icon: '⬆',  label: 'Uploaded',    value: vpn.trafficStats.txHuman },
            ].map(({ icon, label, value }) => (
              <div className="info-tile" key={label}>
                <div className="info-tile-icon">{icon}</div>
                <div className="info-tile-body">
                  <div className="info-tile-label">{label}</div>
                  <div className="info-tile-value">{value || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="disconnected-hint">
          <div className="hint-icon">🔌</div>
          <div className="hint-text">Not connected</div>
          <div className="hint-sub">Connect from the Profiles tab to see live details here</div>
        </div>
      )}
      <LogBox logs={vpn.logs} onClear={() => vpn.setLogs([])} />
    </div>
  );
}
