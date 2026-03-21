import './style.css';
import {
  ImportProfile, LoadProfiles, UpdateProfile, DeleteProfile,
  ConnectProfile, Disconnect, PickOvpnFile, GetTrafficStats,
  LoadAuditLog, ClearAuditLog, CheckProfileCerts,
  CheckForUpdate, CheckChangelog, GetCurrentVersion, PingServer,
  RunSpeedTest, GetSettings, SaveSettings, GetLocalIP
} from '../wailsjs/go/main/App';
import { EventsOn, WindowSetSize, BrowserOpenURL } from '../wailsjs/runtime/runtime';

let profiles = [];
let activeProfileId = null;
let pendingOvpnPath = '';
let timerInterval = null;
let statsInterval = null;
let connectedAt = null;
let certWarnings = {};

document.querySelector('#app').innerHTML = `
  <!-- Update banner (hidden by default) -->
  <div class="update-banner" id="update-banner" style="display:none">
    <span class="update-banner-text">
      🚀 <strong id="update-version"></strong> is available
    </span>
    <a class="update-banner-link" id="update-link" href="#">Download</a>
    <button class="update-banner-dismiss" id="update-dismiss">✕</button>
  </div>

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
    <button class="tab" data-tab="connection">Connection</button>
    <button class="tab" data-tab="audit">Audit</button>
    <button class="tab" data-tab="settings">Settings</button>
  </div>

  <div class="tab-content" id="tab-profiles">
    <div class="ip-banner" id="ip-banner">
      <!--
      <div class="ip-banner-item">
        <span class="ip-banner-label">Public IP</span>
        <span class="ip-banner-value" id="current-ip">fetching...</span>
      </div>
      <div class="ip-banner-divider"></div>
      -->
      <span id="current-ip" style="display:none"></span>
      <div class="ip-banner-item">
        <span class="ip-banner-label">Local IP</span>
        <span class="ip-banner-value" id="local-ip">fetching...</span>
      </div>
    </div>
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

    <div class="speed-section">
      <div class="section-header">
        <span class="section-label">Speed Test</span>
        <button class="btn-speedtest" id="btn-speedtest">▶ Run</button>
      </div>
      <div class="speed-results" id="speed-results">
        <div class="speed-tile">
          <div class="speed-tile-label">⬇ Download</div>
          <div class="speed-tile-value" id="info-dl">—</div>
          <div class="speed-tile-compare" id="cmp-dl"></div>
        </div>
        <div class="speed-tile">
          <div class="speed-tile-label">⬆ Upload</div>
          <div class="speed-tile-value" id="info-ul">—</div>
          <div class="speed-tile-compare" id="cmp-ul"></div>
        </div>
      </div>
      <div class="speed-context" id="speed-context"></div>
    </div>
  </div>

  <div class="tab-content" id="tab-connection" style="display:none">
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
    <div class="disconnected-hint" id="disconnected-hint">
      <div class="hint-icon">🔌</div>
      <div class="hint-text">Not connected</div>
      <div class="hint-sub">Connect from the Profiles tab to see live details here</div>
    </div>
    <div class="log-wrap">
      <div class="log-header">
        <span>Connection Log</span>
        <button class="btn-clear" id="btn-clear">Clear</button>
      </div>
      <div class="log-box" id="log"></div>
    </div>
  </div>

  <div class="tab-content" id="tab-audit" style="display:none">
    <div class="section-header">
      <span class="section-label">Connection History</span>
      <button class="btn-clear-audit" id="btn-clear-audit">Clear</button>
    </div>
    <div class="audit-list" id="audit-list"></div>
  </div>

  <div class="tab-content" id="tab-settings" style="display:none">
    <div class="settings-group">
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">Auto-connect on launch</div>
          <div class="setting-desc">Automatically connect when the app opens</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="setting-autoconnect"/>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-row" id="autoconnect-profile-row" style="display:none">
        <div class="setting-info">
          <div class="setting-label">Profile to connect</div>
          <div class="setting-desc">Which profile to use on auto-connect</div>
        </div>
        <select class="setting-select" id="setting-profile-select"></select>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">Launch on login</div>
          <div class="setting-desc">Start GoVPN automatically when you log in</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="setting-launch-on-login"/>
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">Start minimized to tray</div>
          <div class="setting-desc">Open in the system tray instead of showing the window</div>
        </div>
        <label class="toggle">
          <input type="checkbox" id="setting-start-minimized"/>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
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

  <div class="footer">made with ❤️ by uriel &nbsp;·&nbsp; <span id="app-version">dev</span></div>

  <!-- Changelog modal (hidden by default) -->
  <div class="modal-overlay" id="changelog-overlay" style="display:none">
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">✨ What's new</span>
        <span class="modal-version" id="changelog-version"></span>
      </div>
      <div class="modal-body" id="changelog-body"></div>
      <button class="btn-connect modal-close" id="changelog-close">Got it</button>
    </div>
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
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  document.getElementById('tab-' + name).style.display = 'flex';
  // Hide connect button on audit/settings tabs
  const hideActions = name === 'audit' || name === 'settings';
  document.querySelector('.action-row').style.display = hideActions ? 'none' : 'flex';
  if (name === 'audit') renderAuditLog();
  if (name === 'settings') renderSettings();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
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
  if (info.isExpired) return `<span class="cert-expiry expired" title="Certificate expired on ${info.expiresAt}">⚠ Expired ${info.expiresAt}</span>`;
  if (info.isWarning) return `<span class="cert-expiry warning" title="Certificate expiring soon">⚠ Expires ${info.expiresAt}</span>`;
  return `<span class="cert-expiry ok" title="${info.daysLeft} days remaining">✓ Expires ${info.expiresAt}</span>`;
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
        <div class="ping-badge" id="ping-${p.id}"></div>
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
  // Auto-ping: always ping all profiles after render
  pingAllProfiles();
}

// ── Ping ──
function setPingBadge(profileId, text, cls) {
  const el = document.getElementById('ping-' + profileId);
  if (el) { el.textContent = text; el.className = 'ping-badge ' + cls; }
}

async function pingAllProfiles() {
  for (const p of profiles) {
    setPingBadge(p.id, '📡 pinging...', 'pinging');
    try {
      const r = await PingServer(p.id);
      if (!r.reachable) {
        setPingBadge(p.id, '📡 unreachable', 'unreachable');
      } else {
        const loss = r.packetLoss > 0 ? ` · ${r.packetLoss}% loss` : '';
        const quality = r.avgMs < 50 ? 'good' : r.avgMs < 120 ? 'ok' : 'poor';
        const qualityLabel = r.avgMs < 50 ? 'Excellent' : r.avgMs < 120 ? 'Good' : 'Poor';
        setPingBadge(p.id, `📡 ${r.avgMs.toFixed(0)}ms avg · ${qualityLabel}${loss}`, quality);
      }
    } catch(_) {
      setPingBadge(p.id, '', '');
    }
  }
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
  statusPill.className = `status-pill ${state === 'reconnecting' ? 'connecting' : state}`;
  shield.className = `shield ${state === 'reconnecting' ? 'connecting' : state}`;
  const labels = { connecting: 'Connecting...', connected: 'Connected', disconnected: 'Disconnected', reconnecting: 'Reconnecting...' };
  statusText.textContent = labels[state] || state;
  const isActive = state === 'connected' || state === 'connecting' || state === 'reconnecting';
  btnConnect.style.display    = isActive ? 'none' : 'block';
  btnDisconnect.style.display = isActive ? 'block' : 'none';
  if (state === 'disconnected') btnConnect.disabled = false;

  const hint = document.getElementById('disconnected-hint');
  if (state === 'connected') {
    infoPanel.classList.add('visible');
    if (hint) hint.style.display = 'none';
    WindowSetSize(600, 1020);
    startTimers();
    switchTab('connection');
  } else if (state === 'connecting' || state === 'reconnecting') {
    switchTab('connection');
  } else if (state === 'disconnected') {
    infoPanel.classList.remove('visible');
    if (hint) hint.style.display = 'flex';
    WindowSetSize(600, 720);
    stopTimers();
    uptime.textContent = '00:00'; heroIp.textContent = '—';
    ['info-public-ip','info-server','info-iface','info-cipher','info-rx','info-tx']
      .forEach(id => { document.getElementById(id).textContent = '—'; });
    refreshProfiles();
    refreshPublicIP();
    document.getElementById('current-ip').textContent = 'fetching...';
  }
}

// ── Connect / Disconnect ──
btnConnect.addEventListener('click', async () => {
  if (!activeProfileId) { appendLog('Select a profile first.', 'warn'); return; }
  if (btnConnect.disabled) return;
  btnConnect.disabled = true;
  setStatus('connecting');
  appendLog('Starting OpenVPN...', 'info');
  try {
    await ConnectProfile(activeProfileId);
  } catch(e) {
    if (String(e).includes('already connected')) {
      appendLog('Detected stale connection — force disconnecting...', 'warn');
      try { await Disconnect(); } catch(_) {}
      // Small delay to let the process die
      await new Promise(r => setTimeout(r, 1500));
      try {
        await ConnectProfile(activeProfileId);
      } catch(e2) {
        appendLog(`Error: ${e2}`, 'error');
        setStatus('disconnected');
      }
    } else {
      appendLog(`Error: ${e}`, 'error');
      setStatus('disconnected');
    }
  }
});

btnDisconnect.addEventListener('click', async () => {
  try { await Disconnect(); } catch(e) { appendLog(`Error: ${e}`, 'error'); }
});

// ── Speed test ──
let speedBefore = null; // { downloadMbps, uploadMbps, viaVpn: false }
let speedAfter  = null; // { downloadMbps, uploadMbps, viaVpn: true }

function renderSpeedComparison() {
  const dlEl  = document.getElementById('info-dl');
  const ulEl  = document.getElementById('info-ul');
  const cmpDl = document.getElementById('cmp-dl');
  const cmpUl = document.getElementById('cmp-ul');
  const ctx   = document.getElementById('speed-context');

  const latest = speedAfter || speedBefore;
  if (!latest) return;

  dlEl.textContent = latest.downloadMbps + ' Mbps';
  ulEl.textContent = latest.uploadMbps   + ' Mbps';

  if (speedBefore && speedAfter) {
    const dlDiff = speedAfter.downloadMbps - speedBefore.downloadMbps;
    const ulDiff = speedAfter.uploadMbps   - speedBefore.uploadMbps;
    const fmt = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + ' Mbps';
    const cls = (v) => v >= 0 ? 'cmp-up' : 'cmp-down';
    cmpDl.textContent = `${speedBefore.downloadMbps} → ${speedAfter.downloadMbps} Mbps (${fmt(dlDiff)})`;
    cmpDl.className   = 'speed-tile-compare ' + cls(dlDiff);
    cmpUl.textContent = `${speedBefore.uploadMbps} → ${speedAfter.uploadMbps} Mbps (${fmt(ulDiff)})`;
    cmpUl.className   = 'speed-tile-compare ' + cls(ulDiff);
    ctx.textContent   = 'Without VPN vs through VPN';
    ctx.style.display = 'block';
  } else {
    cmpDl.textContent = cmpUl.textContent = '';
    cmpDl.className = cmpUl.className = 'speed-tile-compare';
    const label = latest.viaVpn ? 'through VPN' : 'without VPN';
    ctx.textContent   = `Tested ${label} · Run again ${latest.viaVpn ? 'after disconnecting' : 'after connecting'} to compare`;
    ctx.style.display = 'block';
  }
}

document.getElementById('btn-speedtest').addEventListener('click', async () => {
  const btn = document.getElementById('btn-speedtest');
  // Snapshot VPN state at the moment the test starts
  const viaVpn = btnDisconnect.style.display !== 'none';
  btn.disabled = true;
  btn.textContent = 'Testing...';
  document.getElementById('info-dl').textContent = '...';
  document.getElementById('info-ul').textContent = '...';
  try {
    const r = await RunSpeedTest();
    if (r.error) {
      appendLog('Speed test error: ' + r.error, 'error');
    } else {
      const result = { ...r, viaVpn };
      if (viaVpn) speedAfter = result; else speedBefore = result;
      renderSpeedComparison();
      appendLog(`Speed test (${viaVpn ? 'through VPN' : 'no VPN'}): ↓ ${r.downloadMbps} Mbps  ↑ ${r.uploadMbps} Mbps`, 'ok');
    }
  } catch(e) {
    appendLog('Speed test failed: ' + e, 'error');
  }
  btn.disabled = false;
  btn.textContent = '▶ Run';
});

// ── VPN events ──
EventsOn('vpn:status', setStatus);
EventsOn('vpn:reconnect', (data) => {
  statusText.textContent = `Reconnecting... (${data.attempt}/${data.total})`;
  appendLog(`Waiting ${data.delay}s before attempt ${data.attempt}/${data.total}...`, 'warn');
});
EventsOn('vpn:info', (info) => {
  if (info.vpnIp)     heroIp.textContent = info.vpnIp;
  if (info.publicIp)  {
    document.getElementById('info-public-ip').textContent = info.publicIp;
    // Also update the profiles tab banner
    document.getElementById('current-ip').textContent = info.publicIp;
  }
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

// ── Settings ──
async function renderSettings() {
  const cfg = await GetSettings();
  const toggle      = document.getElementById('setting-autoconnect');
  const profRow     = document.getElementById('autoconnect-profile-row');
  const select      = document.getElementById('setting-profile-select');
  const loginToggle = document.getElementById('setting-launch-on-login');
  const trayToggle  = document.getElementById('setting-start-minimized');

  toggle.checked      = cfg.autoConnect;
  loginToggle.checked = cfg.launchOnLogin;
  trayToggle.checked  = cfg.startMinimized;
  profRow.style.display = cfg.autoConnect ? 'flex' : 'none';

  select.innerHTML = profiles.map(p =>
    `<option value="${p.id}" ${p.id === cfg.autoConnectProfileId ? 'selected' : ''}>${p.name}</option>`
  ).join('');

  const save = async () => {
    const profileId = select.value || (profiles[0] ? profiles[0].id : '');
    await SaveSettings(
      toggle.checked,
      toggle.checked ? profileId : '',
      loginToggle.checked,
      trayToggle.checked
    );
  };

  toggle.onchange = () => {
    profRow.style.display = toggle.checked ? 'flex' : 'none';
    save();
  };
  select.onchange      = save;
  loginToggle.onchange = save;
  trayToggle.onchange  = save;
}

// ── Init ──
refreshProfiles();
GetCurrentVersion().then(v => { document.getElementById('app-version').textContent = v; }).catch(() => {});

// Fetch and display current public IP
async function refreshPublicIP() {
  // Local IP is instant — no delay needed
  GetLocalIP()
    .then(ip => { document.getElementById('local-ip').textContent = ip || 'unavailable'; })
    .catch(() => { document.getElementById('local-ip').textContent = 'unavailable'; });
  // Public IP needs network — give it time
  GetPublicIP()
    .then(ip => { document.getElementById('current-ip').textContent = ip || 'unavailable'; })
    .catch(() => { document.getElementById('current-ip').textContent = 'unavailable'; });
}
setTimeout(refreshPublicIP, 200);

// ── Update check ──
async function runUpdateCheck() {
  try {
    const info = await CheckForUpdate();
    if (info.hasUpdate) {
      document.getElementById('update-version').textContent = info.latestTag;
      const banner = document.getElementById('update-banner');
      const link   = document.getElementById('update-link');
      banner.style.display = 'flex';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        BrowserOpenURL(info.releaseUrl);
      });
      document.getElementById('update-dismiss').addEventListener('click', () => {
        banner.style.display = 'none';
      });
    }
  } catch(_) {}
}

// ── Changelog on first boot of new version ──
async function runChangelogCheck() {
  try {
    const notes = await CheckChangelog();
    if (!notes) return;
    // Grab version from update info (or fall back to banner text)
    const overlay = document.getElementById('changelog-overlay');
    const body    = document.getElementById('changelog-body');
    // Render markdown-ish: convert lines starting with - or * to bullets
    body.innerHTML = notes
      .split('\n')
      .map(l => {
        l = l.trim();
        if (!l) return '';
        if (l.startsWith('## ')) return `<div class="cl-heading">${l.slice(3)}</div>`;
        if (l.startsWith('- ') || l.startsWith('* ')) return `<div class="cl-item">• ${l.slice(2)}</div>`;
        return `<div class="cl-text">${l}</div>`;
      })
      .join('');
    overlay.style.display = 'flex';
    document.getElementById('changelog-close').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  } catch(_) {}
}

runChangelogCheck();
runUpdateCheck();
