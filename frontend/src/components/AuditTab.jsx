import { useState, useEffect } from 'react';

export default function AuditTab({ vpn }) {
  const [entries, setEntries] = useState([]);

  const load = async () => {
    try {
      const log = await vpn.LoadAuditLog();
      setEntries(log || []);
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  const clear = async () => {
    if (!confirm('Clear all audit entries?')) return;
    await vpn.ClearAuditLog();
    setEntries([]);
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <span className="section-label">Audit Log</span>
        <button className="btn-clear" onClick={clear} disabled={entries.length === 0}>Clear</button>
      </div>
      {entries.length === 0 ? (
        <div className="no-profiles">No audit entries yet.</div>
      ) : (
        <div className="audit-list">
          {[...entries].reverse().map(e => (
            <div className="audit-entry" key={e.id}>
              <div className="audit-icon">🔐</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="audit-profile">{e.profileName}</span>
                  <span className="audit-meta">{e.duration}</span>
                </div>
                <div className="audit-meta">{e.connectedAt}</div>
                {(e.vpnIp || e.serverIp) && (
                  <div className="audit-ips">
                    {e.vpnIp && <span>VPN: {e.vpnIp}</span>}
                    {e.vpnIp && e.serverIp && <span> · </span>}
                    {e.serverIp && <span>Server: {e.serverIp}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
