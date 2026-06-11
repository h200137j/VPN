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
        <div className="modal-titlebar">
          <span className="modal-dots"><i /><i /><i /></span>
          <span className="modal-title">CHANGELOG.md</span>
          <span className="modal-version">{version}</span>
          <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="modal-body">
          <pre>{notes}</pre>
        </div>
        <div className="modal-footer">
          <button className="btn-primary" onClick={() => setOpen(false)}>close</button>
        </div>
      </div>
    </div>
  );
}
