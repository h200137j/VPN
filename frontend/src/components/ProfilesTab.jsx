import { useState, useEffect } from 'react';
import SpeedTest from './SpeedTest';
import Spinner from './Spinner';

function certBadge(info) {
  if (!info) return <span className="cert-chip none">no cert</span>;
  if (info.isExpired) return <span className="cert-chip expired" title={`Expired on ${info.expiresAt}`}>✗ expired {info.expiresAt}</span>;
  if (info.isWarning) return <span className="cert-chip warning" title="Expiring soon">! expires {info.expiresAt}</span>;
  return <span className="cert-chip ok" title={`${info.daysLeft} days remaining`}>✓ {info.expiresAt}</span>;
}

function PingBadge({ profileId, PingServer }) {
  const [ping, setPing] = useState(null); // null = loading

  useEffect(() => {
    setPing(null);
    PingServer(profileId).then(r => {
      if (!r.reachable) {
        setPing({ text: 'unreachable', cls: 'unreachable' });
      } else {
        const loss = r.packetLoss > 0 ? ` · ${r.packetLoss}% loss` : '';
        const quality = r.avgMs < 50 ? 'good' : r.avgMs < 120 ? 'ok' : 'poor';
        setPing({ text: `${r.avgMs.toFixed(0)}ms${loss}`, cls: quality });
      }
    }).catch(() => setPing({ text: '—', cls: '' }));
  }, [profileId]);

  if (ping === null) {
    return <span className="ping-badge pinging"><Spinner /> rtt</span>;
  }
  return <span className={`ping-badge ${ping.cls}`}>rtt {ping.text}</span>;
}

export default function ProfilesTab({ vpn }) {
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [formName, setFormName]     = useState('');
  const [formUser, setFormUser]     = useState('');
  const [formPass, setFormPass]     = useState('');
  const [formFile, setFormFile]     = useState('');
  const [pendingPath, setPendingPath] = useState('');
  const [showPw, setShowPw]         = useState(false);

  const openAdd = () => {
    setEditingId(null); setFormName(''); setFormUser('');
    setFormPass(''); setFormFile(''); setPendingPath('');
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingId(p.id); setFormName(p.name); setFormUser(p.username);
    setFormPass(''); setFormFile(p.ovpnPath?.split('/').pop() || '');
    setPendingPath(''); setShowForm(true);
  };

  const pickFile = async () => {
    const path = await vpn.PickOvpnFile();
    if (path) {
      setPendingPath(path);
      setFormFile(path.split('/').pop());
      if (!formName) setFormName(path.split('/').pop().replace('.ovpn', ''));
    }
  };

  const save = async () => {
    try {
      if (editingId) {
        await vpn.UpdateProfile(editingId, formName, formUser, formPass);
        vpn.appendLog(`profile "${formName}" updated`, 'ok');
      } else {
        if (!pendingPath) { vpn.appendLog('select an .ovpn file first', 'warn'); return; }
        const p = await vpn.ImportProfile(formName, pendingPath, formUser, formPass);
        vpn.appendLog(`profile "${p.name}" saved`, 'ok');
        vpn.setActiveProfileId(p.id);
      }
      setShowForm(false);
      vpn.refreshProfiles();
    } catch(e) { vpn.appendLog(`error: ${e}`, 'error'); }
  };

  const deleteProfile = async (id) => {
    if (!confirm('Delete this profile?')) return;
    await vpn.DeleteProfile(id);
    if (vpn.activeProfileId === id) vpn.setActiveProfileId(null);
    vpn.refreshProfiles();
  };

  return (
    <div className="tab-content">
      <div className="statbar">
        <span id="current-ip" style={{ display: 'none' }}></span>
        <span className="statbar-k">local_ip</span>
        <span className="statbar-v">{vpn.localIP}</span>
      </div>

      <div className="section-header">
        <span className="section-label">// profiles</span>
        <button className="btn-add" onClick={openAdd}>+ add</button>
      </div>

      <div className="profile-list">
        {vpn.profiles.length === 0 && (
          <div className="empty-state">no profiles yet — add one to get started</div>
        )}
        {vpn.profiles.map(p => (
          <div
            key={p.id}
            className={`profile-item${p.id === vpn.activeProfileId ? ' active' : ''}`}
            onClick={() => vpn.setActiveProfileId(p.id)}
          >
            <span className="profile-caret">❯</span>
            <div className="profile-info">
              <div className="profile-name">{p.name}</div>
              <div className="profile-meta">
                <span>{p.username || 'no auth'}</span>
                <span className="meta-sep">·</span>
                <PingBadge profileId={p.id} PingServer={vpn.PingServer} />
              </div>
            </div>
            <div className="profile-cert">{certBadge(vpn.certWarnings[p.id])}</div>
            <div className="profile-actions" onClick={e => e.stopPropagation()}>
              <button className="btn-mini" onClick={() => openEdit(p)} title="Edit">edit</button>
              <button className="btn-mini btn-mini-danger" onClick={() => deleteProfile(p.id)} title="Delete">del</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card add-card">
          <div className="card-title">{editingId ? '// edit profile' : '// new profile'}</div>
          <div className="field">
            <label>name</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. work" />
          </div>
          {!editingId && (
            <div className="field">
              <label>config file</label>
              <div className="file-row">
                <span className={`file-path${formFile ? ' selected' : ''}`}>{formFile || 'no file selected'}</span>
                <button className="btn-secondary" onClick={pickFile}>browse…</button>
              </div>
            </div>
          )}
          <div className="two-col">
            <div className="field">
              <label>username</label>
              <input type="text" value={formUser} onChange={e => setFormUser(e.target.value)} placeholder="username" autoComplete="off" />
            </div>
            <div className="field">
              <label>password</label>
              <div className="password-row">
                <input type={showPw ? 'text' : 'password'} value={formPass} onChange={e => setFormPass(e.target.value)} placeholder="password" />
                <button className="btn-secondary btn-pw" onClick={() => setShowPw(p => !p)}>{showPw ? 'hide' : 'show'}</button>
              </div>
            </div>
          </div>
          <div className="add-actions">
            <button className="btn-ghost" onClick={() => setShowForm(false)}>cancel</button>
            <button className="btn-primary" onClick={save}>save</button>
          </div>
        </div>
      )}

      <SpeedTest vpn={vpn} />
    </div>
  );
}
