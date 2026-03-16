import './style.css';
import {
  ImportProfile, LoadProfiles, UpdateProfile, DeleteProfile,
  ConnectProfile, Disconnect, PickOvpnFile, GetTrafficStats,
  LoadAuditLog, ClearAuditLog, CheckProfileCerts
} from '../wailsjs/go/main/App';
import { EventsOn, WindowSetSize } from '../wailsjs/runtime/runtime';

let profiles = [];
let activeProfileId = null;
let pendingOvpnPath = '';
let timerInterval = null;
let statsInterval = null;
let connectedAt = null;
let certWarnings = {};

document.querySelector('#app').innerHTML = `
  <div class="header">
    <div class="logo-area">
      <div class="shield" id="shield">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z" fill="currentColor"/></svg>
      </div>
      <div><h1>GoVPN</h1><span class="subtitle">Secure OpenVPN Client</span></div>
    </div>
    <div class="header-right">
      <div class="status-pill disconnected" id="status-pill">
        <div class="dot disconnected" id="dot"></div>
        <span id="status-text">Disconnected</span>
      </div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="profiles">Profiles</button>
    <button class="tab" data-tab="audit">Audit Log</button>
  </div>

  <div class="tab-content" id="tab-profiles">
    <div class="section-header">
      <span class="section-label">Profiles</span>
      <button class="btn-add" id="btn-add-profile">+ Add Profile</button>
    </div>
    <div class="profile-list" id="profile-list"></div>
    <div class="card add-card" id="add-card" style="display:none">
      <div class="card-title" id="add-card-title">New Profile</div>
      <div class="field">
        <label>Profile Name</label>
        <input type="text" id="new-name" placeholder="e.g. Work VPN"/>
      </div>
      <div class="field">
        <label>OpenVPN Config File</label>
        <div class="file-row">
          <span class="file-path" id="new-file-label">No file selected</span>
          <button class="btn-secondary" id="btn-pick-new">Browse</button>
        </div>
      </div>
      <div class="two-col">
        <div class="field">
          <label>Username</label>
          <input type="text" id="new-username" placeholder="username" autocomplete="off"/>
        </div>
        <div class="field">
          <label>Password</label>
          <div class="password-row">
            <input type="password" id="new-password" placeholder="password"/>
            <button class="btn-icon" id="btn-toggle-new-pw">👁</button>
          </div>
        </div>
      </div>
      <div class="add-actions">
        <button class="btn-secondary" id="btn-cancel-add">Cancel</button>
        <button class="btn-save-profile" id="btn-save-profile">Save Profile</button>
      </div>
    </div>
  </div>

  <div class="tab-content" id="tab-audit" style="display:none">
    <div class="section-header">
      <span class="section-label">Connection History</span>
      <button class="btn-clear-audit" id="btn-clear-audit">Clear</button>
    </div>
    <div class="audit-list" id="audit-list"></div>
  </div>

  <div class="info-panel" id="info-panel">
    <div class="info-hero">
      <div class="info-hero-ip" id="hero-ip">—</div>
      <div class="info-hero-label">VPN IP Address</div>
      <div class="uptime-badge" id="uptime">00:00</div>
    </div>
    <div class="info-grid">
      <div class="info-tile"><div class="info-tile-icon">🌐</div><div class="info-tile-body"><div class="info-tile-label">Public IP</div><div class="info-tile-value" id="info-public-ip">—</div></div></div>
      <div class="info-tile"><div class="info-tile-icon">🖥</div><div class="info-tile-body"><div class="info-tile-label">VPN Server</div><div class="info-tile-value" id="info-server">—</div></div></div>
      <div class="info-tile"><div class="info-tile-icon">🔌</div><div class="info-tile-body"><div class="info-tile-label">Interface</div><div class="info-tile-value" id="info-iface">—</div></div></div>
      <div class="info-tile"><div class="info-tile-icon">🔒</div><div class="info-tile-body"><div class="info-tile-label">Cipher</div><div class="info-tile-value" id="info-cipher">—</div></div></div>
      <div class="info-tile"><div class="info-tile-icon">⬇</div><div class="info-tile-body"><div class="info-tile-label">Downloaded</div><div class="info-tile-value" id="info-rx">—</div></div></div>
      <div class="info-tile"><div class="info-tile-icon">⬆</div><div class="info-tile-body"><div class="info-tile-label">Uploaded</div><div class="info-tile-value" id="info-tx">—</div></div></div>
    </div>
  </div>

  <div class="action-row">
    <button class="btn-connect" id="btn-connect">Connect</button>
    <button class="btn-disconnect" id="btn-disconnect" style="display:none">Disconnect</button>
  </div>

  <div class="log-wrap">
    <div class="log-header">
      <span>Connection Log</span>
      <button class="btn-clear" id="btn-clear">Clear</button>
    </div>
    <div class="log-box" id="log"></div>
  </div>
`;

// ── Element refs ──
const shield        = document.getElementById('shield');
const dot           = document.getElementById('dot');
const statusPill    = document.getElementById('status-pill');
const statusText    = document.getElementById('status-text');
const profileList   = document.getElementById('profile-list');
const addCard       = document.getElementById('add-card');
const addCardTitle  = document.getElementById('add-card-title');
const btnAddProfile = document.getElementById('btn-add-profile');
const btnPickNew    = document.getElementById('btn-pick-new');
const btnCancelAdd  = document.getElementById('btn-cancel-add');
const btnSaveProfile= document.getElementById('btn-save-profile');
const btnToggleNewPw= document.getElementById('btn-toggle-new-pw');
const newName       = document.getElementById('new-name');
const newFileLabel  = document.getElementById('new-file-label');
const newUsername   = document.getElementById('new-username');
const newPassword   = document.getElementById('new-password');
const infoPanel     = document.getElementById('info-panel');
const heroIp        = document.getElementById('hero-ip');
const uptime        = document.getElementById('uptime');
const btnConnect    = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const log           = document.getElementById('log');
const auditList     = document.getElementById('audit-list');

// ── Tabs ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).style.display = 'flex';
    if (tab.dataset.tab === 'audit') renderAuditLog();
  });
});

// ── Logging ──
function appendLog(msg, type = 'info') {
  const p = document.createElement('p');
  p.className = type;
  p.textContent = msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}
document.getElementById('btn-clear').addEventListener('click', () => { log.innerHTML = ''; });

// ── Password toggle ──
btnToggleNewPw.addEventListener('click', () => {
  const hidden = newPassword.type === 'password';
  newPassword.type = hidden ? 'text' : 'password';
  btnToggleNewPw.textContent = hidden ? '🙈' : '👁';
});

// ── Audit log ──
async function renderAuditLog() {
  const entries = await LoadAuditLog();
  if (!entries || entries.length === 0) {
    auditList.innerHTML = '<div class="no-profiles">No connection history yet.</div>';
    return;
  }
  auditList.innerHTML = entries.map(e => `
    <div class="audit-entry">
      <div class="audit-icon">📡</div>
      <div class="audit-body">
        <div class="audit-profile">${e.profileName}</div>
        <div class="audit-meta">${e.connectedAt} &nbsp;·&nbsp; ${e.duration}</div>
        <div class="audit-ips">${e.vpnIp ? `VPN: ${e.vpnIp}` : ''} ${e.serverIp ? `· Server: ${e.serverIp}` : ''}</div>
      </div>
    </div>
  `).join('');
}

document.getElementById('btn-clear-audit').addEventListener('click', async () => {
  await ClearAuditLog();
  renderAuditLog();
});

// ── Cert warnings ──
async function loadCertWarnings() {
  try {
    certWarnings = await CheckProfileCerts() || {};
  } catch(_) { certWarnings = {}; }
}

function certBadge(profileId) {
  const info = certWarnings[profileId];
  if (!info) return '<span class="cert-expiry none">No cert</span>';
  if (info.isExpired) return `<span class="cert-expiry expired" title="Certificate expired">⚠ Expired</span>`;
  if (info.isWarning) return `<span class="cert-expiry warning" title="Expiring soon">⚠ ${info.expiresAt}</span>`;
  return `<span class="cert-expiry ok" title="${info.daysLeft} days remaining">✓ ${info.expiresAt}</span>`;
}

// ── Profile rendering ──
function renderProfiles() {
  profileList.innerHTML = '';
  if (profiles.length === 0) {
    profileList.innerHTML = '<div class="no-profiles">No profiles yet. Add one to get started.</div>';
    return;
  }
  profiles.forEach(p => {
    const el = document.createElement('div');
    el.className = 'profile-item' + (p.id === activeProfileId ? ' active' : '');
    el.dataset.id = p.id;
    el.innerHTML = `
      <div class="profile-icon">🔐</div>
      <div class="profile-info">
        <div class="profile-name">${p.name}</div>
        <div class="profile-meta">${p.username || 'no username'}</div>
      </div>
      <div class="profile-cert">${certBadge(p.id)}</div>
      <div class="profile-actions">
        <button class="btn-profile-edit" data-id="${p.id}" title="Edit">✏️</button>
        <button class="btn-profile-delete" data-id="${p.id}" title="Delete">🗑</button>
      </div>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.profile-actions')) return;
      activeProfileId = p.id;
      renderProfiles();
    });
    profileList.appendChild(el);
  });

  profileList.querySelectorAll('.btn-profile-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditForm(btn.dataset.id));
  });
  profileList.querySelectorAll('.btn-profile-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this profile?')) return;
      await DeleteProfile(btn.dataset.id);
      if (activeProfileId === btn.dataset.id) activeProfileId = null;
      await refreshProfiles();
    });
  });
}

async function refreshProfiles() {
  profiles = await LoadProfiles();
  if (!activeProfileId && profiles.length > 0) activeProfileId = profiles[0].id;
  await loadCertWarnings();
  renderProfiles();
}

// ── Add / Edit form ──
let editingId = null;

function openAddForm() {
  editingId = null;
  addCardTitle.textContent = 'New Profile';
  newName.value = ''; newUsername.value = ''; newPassword.value = '';
  newFileLabel.textContent = 'No file selected';
  newFileLabel.classList.remove('selected');
  pendingOvpnPath = '';
  addCard.style.display = 'flex';
  newName.focus();
}

function openEditForm(id) {
  const p = profiles.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  addCardTitle.textContent = 'Edit Profile';
  newName.value = p.name; newUsername.value = p.username; newPassword.value = '';
  newFileLabel.textContent = p.ovpnPath.split('/').pop();
  newFileLabel.classList.add('selected');
  pendingOvpnPath = '';
  addCard.style.display = 'flex';
  newName.focus();
}

btnAddProfile.addEventListener('click', openAddForm);
btnCancelAdd.addEventListener('click', () => { addCard.style.display = 'none'; });

btnPickNew.addEventListener('click', async () => {
  const path = await PickOvpnFile();
  if (path) {
    pendingOvpnPath = path;
    newFileLabel.textContent = path.split('/').pop();
    newFileLabel.classList.add('selected');
    if (!newName.value) newName.value = path.split('/').pop().replace('.ovpn', '');
  }
});

btnSaveProfile.addEventListener('click', async () => {
  if (editingId) {
    try {
      await UpdateProfile(editingId, newName.value, newUsername.value, newPassword.value);
      appendLog(`Profile "${newName.value}" updated.`, 'ok');
      addCard.style.display = 'none';
      await refreshProfiles();
    } catch(e) { appendLog(`Error: ${e}`, 'error'); }
  } else {
    if (!pendingOvpnPath) { appendLog('Please select an .ovpn file.', 'warn'); return; }
    try {
      const p = await ImportProfile(newName.value, pendingOvpnPath, newUsername.value, newPassword.value);
      appendLog(`Profile "${p.name}" saved. You can delete the original .ovpn file.`, 'ok');
      activeProfileId = p.id;
      addCard.style.display = 'none';
      await refreshProfiles();
    } catch(e) { appendLog(`Error: ${e}`, 'error'); }
  }
});

// ── Timers ──
function formatUptime(startMs) {
  const s = Math.floor((Date.now() - startMs) / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function startTimers() {
  connectedAt = Date.now();
  timerInterval = setInterval(() => { uptime.textContent = formatUptime(connectedAt); }, 1000);
  statsInterval = setInterval(async () => {
    try {
      const s = await GetTrafficStats();
      document.getElementById('info-rx').textContent = s.rxHuman || '—';
      document.getElementById('info-tx').textContent = s.txHuman || '—';
    } catch(_) {}
  }, 2000);
}

function stopTimers() {
  clearInterval(timerInterval); clearInterval(statsInterval);
  timerInterval = statsInterval = connectedAt = null;
}

// ── Status ──
function setStatus(state) {
  dot.className = `dot ${state}`;
  statusPill.className = `status-pill ${state}`;
  shield.className = `shield ${state}`;
  statusText.textContent = { connecting: 'Connecting...', connected: 'Connected', disconnected: 'Disconnected' }[state] || state;
  const isActive = state === 'connected' || state === 'connecting';
  btnConnect.style.display    = isActive ? 'none' : 'block';
  btnDisconnect.style.display = isActive ? 'block' : 'none';
  btnConnect.disabled = false;
  if (state === 'connected') {
    infoPanel.classList.add('visible'); WindowSetSize(520, 960); startTimers();
  } else if (state === 'disconnected') {
    infoPanel.classList.remove('visible'); WindowSetSize(480, 700); stopTimers();
    uptime.textContent = '00:00'; heroIp.textContent = '—';
    ['info-public-ip','info-server','info-iface','info-cipher','info-rx','info-tx']
      .forEach(id => { document.getElementById(id).textContent = '—'; });
    refreshProfiles(); // refresh to update audit log badge
  }
}

// ── Connect / Disconnect ──
btnConnect.addEventListener('click', async () => {
  if (!activeProfileId) { appendLog('Select a profile first.', 'warn'); return; }
  btnConnect.disabled = true;
  setStatus('connecting');
  appendLog('Starting OpenVPN...', 'info');
  try { await ConnectProfile(activeProfileId); }
  catch(e) { appendLog(`Error: ${e}`, 'error'); setStatus('disconnected'); }
});

btnDisconnect.addEventListener('click', async () => {
  try { await Disconnect(); } catch(e) { appendLog(`Error: ${e}`, 'error'); }
});

// ── VPN events ──
EventsOn('vpn:status', setStatus);
EventsOn('vpn:info', (info) => {
  if (info.vpnIp)     heroIp.textContent = info.vpnIp;
  if (info.publicIp)  document.getElementById('info-public-ip').textContent = info.publicIp;
  if (info.serverIp)  document.getElementById('info-server').textContent = info.serverIp;
  if (info.interface) document.getElementById('info-iface').textContent = info.interface;
  if (info.cipher)    document.getElementById('info-cipher').textContent = info.cipher;
});
EventsOn('vpn:log', (line) => {
  let type = 'info';
  if (/error|failed|fatal/i.test(line)) type = 'error';
  else if (/warn/i.test(line)) type = 'warn';
  else if (/sequence completed|connected/i.test(line)) type = 'ok';
  appendLog(line, type);
});

// ── Init ──
refreshProfiles();
