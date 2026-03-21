import React, { useState, useEffect } from 'react';
import SpeedTest from './SpeedTest';

function certBadge(info) {
  if (!info) return <span className="cert-expiry none">No cert</span>;
  if (info.isExpired) return <span className="cert-expiry expired" title={`Expired on ${info.expiresAt}`}>⚠ Expired {info.expiresAt}</span>;
  if (info.isWarning) return <span className="cert-expiry warning" title="Expiring soon">⚠ Expires {info.expiresAt}</span>;
  return <span className="cert-expiry ok" title={`${info.daysLeft} days remaining`}>✓ Expires {info.expiresAt}</span>;
}

// 6 ping loading animations that cycle while waiting
const PING_ANIMATIONS = [
  () => <span className="ping-anim dots">pinging<span>.</span><span>.</span><span>.</span></span>,
  () => <span className="ping-anim radar">📡 <span className="radar-spin">◌</span></span>,
  () => <span className="ping-anim bounce"><span>p</span><span>i</span><span>n</span><span>g</span><span>!</span></span>,
  () => <span className="ping-anim pulse-bar"><span/><span/><span/><span/><span/></span>,
  () => <span className="ping-anim typewriter">asking nicely...</span>,
  () => <span className="ping-anim zap">⚡ <span className="zap-flicker">measuring</span></span>,
];

function PingBadge({ profileId, PingServer }) {
  const [ping, setPing] = useState(null); // null = loading
  const [animIdx, setAnimIdx] = useState(0);

  useEffect(() => {
    setPing(null);
    setAnimIdx(0);
    PingServer(profileId).then(r => {
      if (!r.reachable) {
        setPing({ text: '📡 unreachable', cls: 'unreachable' });
      } else {
        const loss = r.packetLoss > 0 ? ` · ${r.packetLoss}% loss` : '';
        const quality = r.avgMs < 50 ? 'good' : r.avgMs < 120 ? 'ok' : 'poor';
        const label   = r.avgMs < 50 ? 'Excellent' : r.avgMs < 120 ? 'Good' : 'Poor';
        setPing({ text: `📡 ${r.avgMs.toFixed(0)}ms · ${label}${loss}`, cls: quality });
      }
    }).catch(() => setPing({ text: '', cls: '' }));
  }, [profileId]);

  // cycle animations while loading
  useEffect(() => {
    if (ping !== null) return;
    const t = setInterval(() => setAnimIdx(i => (i + 1) % PING_ANIMATIONS.length), 600);
    return () => clearInterval(t);
  }, [ping]);

  if (ping === null) {
    const Anim = PING_ANIMATIONS[animIdx];
    return <div className="ping-badge pinging"><Anim /></div>;
  }

  return <div className={`ping-badge ${ping.cls}`}>{ping.text}</div>;
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
        vpn.appendLog(`Profile "${formName}" updated.`, 'ok');
      } else {
        if (!pendingPath) { vpn.appendLog('Please select an .ovpn file.', 'warn'); return; }
        const p = await vpn.ImportProfile(formName, pendingPath, formUser, formPass);
        vpn.appendLog(`Profile "${p.name}" saved.`, 'ok');
        vpn.setActiveProfileId(p.id);
      }
      setShowForm(false);
      vpn.refreshProfiles();
    } catch(e) { vpn.appendLog(`Error: ${e}`, 'error'); }
  };

  const deleteProfile = async (id) => {
    if (!confirm('Delete this profile?')) return;
    await vpn.DeleteProfile(id);
    if (vpn.activeProfileId === id) vpn.setActiveProfileId(null);
    vpn.refreshProfiles();
  };

  return (
    <div className="tab-content">
      {/* IP Banner */}
      <div className="ip-banner">
        <span id="current-ip" style={{ display: 'none' }}></span>
        <div className="ip-banner-item">
          <span className="ip-banner-label">Local IP</span>
          <span className="ip-banner-value">{vpn.localIP}</span>
        </div>
      </div>

      {/* Profile list */}
      <div className="section-header">
        <span className="section-label">Profiles</span>
        <button className="btn-add" onClick={openAdd}>+ Add Profile</button>
      </div>

      <div className="profile-list">
        {vpn.profiles.length === 0 && (
          <div className="no-profiles">No profiles yet. Add one to get started.</div>
        )}
        {vpn.profiles.map(p => (
          <div
            key={p.id}
            className={`profile-item${p.id === vpn.activeProfileId ? ' active' : ''}`}
            onClick={() => vpn.setActiveProfileId(p.id)}
          >
            <div className="profile-icon">🔐</div>
            <div className="profile-info">
              <div className="profile-name">{p.name}</div>
              <div className="profile-meta">{p.username || 'no username'}</div>
              <PingBadge profileId={p.id} PingServer={vpn.PingServer} />
            </div>
            <div className="profile-cert">{certBadge(vpn.certWarnings[p.id])}</div>
            <div className="profile-actions" onClick={e => e.stopPropagation()}>
              <button className="btn-profile-edit" onClick={() => openEdit(p)} title="Edit">✏️</button>
              <button className="btn-profile-delete" onClick={() => deleteProfile(p.id)} title="Delete">🗑</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card add-card">
          <div className="card-title">{editingId ? 'Edit Profile' : 'New Profile'}</div>
          <div className="field">
            <label>Profile Name</label>
            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Work VPN" />
          </div>
          {!editingId && (
            <div className="field">
              <label>OpenVPN Config File</label>
              <div className="file-row">
                <span className={`file-path${formFile ? ' selected' : ''}`}>{formFile || 'No file selected'}</span>
                <button className="btn-secondary" onClick={pickFile}>Browse</button>
              </div>
            </div>
          )}
          <div className="two-col">
            <div className="field">
              <label>Username</label>
              <input type="text" value={formUser} onChange={e => setFormUser(e.target.value)} placeholder="username" autoComplete="off" />
            </div>
            <div className="field">
              <label>Password</label>
              <div className="password-row">
                <input type={showPw ? 'text' : 'password'} value={formPass} onChange={e => setFormPass(e.target.value)} placeholder="password" />
                <button className="btn-icon" onClick={() => setShowPw(p => !p)}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>
          </div>
          <div className="add-actions">
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn-save-profile" onClick={save}>Save Profile</button>
          </div>
        </div>
      )}

      <SpeedTest vpn={vpn} />
    </div>
  );
}
