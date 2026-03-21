import { useState, useEffect } from 'react';

export default function ChangelogModal({ vpn, version }) {
  const [notes, setNotes] = useState('');
  const [open, setOpen]   = useState(false);

  useEffect(() => {
    vpn.CheckChangelog().then(body => {
      if (body) { setNotes(body); setOpen(true); }
    }).catch(() => {});
  }, []);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">What's new</span>
          <span className="modal-version">{version}</span>
          <button className="btn-icon modal-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{notes}</pre>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-save-profile" onClick={() => setOpen(false)}>Got it</button>
        </div>
      </div>
    </div>
  );
}
