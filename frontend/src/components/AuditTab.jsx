import { useState, useEffect, useRef } from 'react';

function AuditEntry({ entry, onDelete }) {
  const [removing, setRemoving] = useState(false);
  const [hover, setHover]       = useState(false);

  const handleDelete = () => {
    setRemoving(true);
    // Wait for exit animation before telling parent to remove from state
    setTimeout(() => onDelete(entry.id), 320);
  };

  return (
    <div
      className={`audit-entry${removing ? ' audit-entry-exit' : ' audit-entry-enter'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="audit-icon">🔐</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="audit-profile">{entry.profileName}</span>
          <span className="audit-meta">{entry.duration}</span>
        </div>
        <div className="audit-meta">{entry.connectedAt}</div>
        {(entry.vpnIp || entry.serverIp) && (
          <div className="audit-ips">
            {entry.vpnIp && <span>VPN: {entry.vpnIp}</span>}
            {entry.vpnIp && entry.serverIp && <span> · </span>}
            {entry.serverIp && <span>Server: {entry.serverIp}</span>}
          </div>
        )}
      </div>
      <button
        className={`audit-delete-btn${hover ? ' visible' : ''}`}
        onClick={handleDelete}
        title="Delete entry"
      >
        ✕
      </button>
    </div>
  );
}

export default function AuditTab({ vpn }) {
  const [entries, setEntries]   = useState([]);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    try {
      const log = await vpn.LoadAuditLog();
      setEntries(log || []);
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  const deleteEntry = async (id) => {
    try {
      await vpn.DeleteAuditEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (_) {}
  };

  const clear = async () => {
    if (!confirm('Clear all audit entries?')) return;
    setClearing(true);
    // Stagger exit animations, then wipe
    setTimeout(async () => {
      await vpn.ClearAuditLog();
      setEntries([]);
      setClearing(false);
    }, 400);
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <span className="section-label">Audit Log</span>
        <button className="btn-clear" onClick={clear} disabled={entries.length === 0 || clearing}>
          Clear all
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="no-profiles">No audit entries yet.</div>
      ) : (
        <div className={`audit-list${clearing ? ' audit-list-clearing' : ''}`}>
          {[...entries].reverse().map((e, i) => (
            <AuditEntry
              key={e.id}
              entry={e}
              onDelete={deleteEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
