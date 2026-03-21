import React, { useState } from 'react';

export default function SpeedTest({ vpn }) {
  const [running, setRunning]     = useState(false);
  const [before, setBefore]       = useState(null);
  const [after, setAfter]         = useState(null);

  const isConnected = vpn.status === 'connected';

  const run = async () => {
    setRunning(true);
    const viaVpn = isConnected;
    try {
      const r = await vpn.RunSpeedTest();
      if (r.error) {
        vpn.appendLog('Speed test error: ' + r.error, 'error');
      } else {
        const result = { ...r, viaVpn };
        if (viaVpn) setAfter(result); else setBefore(result);
        vpn.appendLog(`Speed test (${viaVpn ? 'through VPN' : 'no VPN'}): ↓ ${r.downloadMbps} Mbps  ↑ ${r.uploadMbps} Mbps`, 'ok');
      }
    } catch(e) {
      vpn.appendLog('Speed test failed: ' + e, 'error');
    }
    setRunning(false);
  };

  const latest = after || before;
  const hasBoth = before && after;

  const dlDiff = hasBoth ? (after.downloadMbps - before.downloadMbps) : null;
  const ulDiff = hasBoth ? (after.uploadMbps   - before.uploadMbps)   : null;
  const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' Mbps';

  let contextText = '';
  if (hasBoth) contextText = 'Without VPN vs through VPN';
  else if (latest) contextText = `Tested ${latest.viaVpn ? 'through VPN' : 'without VPN'} · Run again ${latest.viaVpn ? 'after disconnecting' : 'after connecting'} to compare`;

  return (
    <div className="speed-section">
      <div className="section-header">
        <span className="section-label">Speed Test</span>
        <button className="btn-speedtest" onClick={run} disabled={running}>
          {running ? 'Testing...' : '▶ Run'}
        </button>
      </div>
      <div className="speed-results">
        <div className="speed-tile">
          <div className="speed-tile-label">⬇ Download</div>
          <div className="speed-tile-value">{latest ? latest.downloadMbps + ' Mbps' : '—'}</div>
          {hasBoth && (
            <div className={`speed-tile-compare ${dlDiff >= 0 ? 'cmp-up' : 'cmp-down'}`}>
              {before.downloadMbps} → {after.downloadMbps} Mbps ({fmt(dlDiff)})
            </div>
          )}
        </div>
        <div className="speed-tile">
          <div className="speed-tile-label">⬆ Upload</div>
          <div className="speed-tile-value">{latest ? latest.uploadMbps + ' Mbps' : '—'}</div>
          {hasBoth && (
            <div className={`speed-tile-compare ${ulDiff >= 0 ? 'cmp-up' : 'cmp-down'}`}>
              {before.uploadMbps} → {after.uploadMbps} Mbps ({fmt(ulDiff)})
            </div>
          )}
        </div>
      </div>
      {contextText && <div className="speed-context">{contextText}</div>}
    </div>
  );
}
