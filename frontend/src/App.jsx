import { useState, useEffect, useCallback } from 'react';
import { useVPN } from './hooks/useVPN';
import Header from './components/Header';
import TabBar from './components/TabBar';
import ProfilesTab from './components/ProfilesTab';
import ConnectionTab from './components/ConnectionTab';
import AuditTab from './components/AuditTab';
import SettingsTab from './components/SettingsTab';
import UpdateBanner from './components/UpdateBanner';
import ChangelogModal from './components/ChangelogModal';
import ActionRow from './components/ActionRow';

const DISC_ANIM_MS = 5500; // how long to show the disconnecting animation
const TAB_ORDER = ['profiles', 'connection', 'audit', 'settings'];

export default function App() {
  const vpn = useVPN();
  const [activeTab, setActiveTab]     = useState('profiles');
  const [version, setVersion]         = useState('dev');
  const [disconnecting, setDisconnecting] = useState(false);

  // Switch to session tab whenever VPN is active
  useEffect(() => {
    if (vpn.status === 'connecting' || vpn.status === 'connected' || vpn.status === 'reconnecting') {
      setActiveTab('connection');
      setDisconnecting(false);
    }
    // Don't clear disconnecting here — the timer in handleDisconnect owns that
  }, [vpn.status]);

  // On first load, pre-switch to session tab if auto-connect is on
  useEffect(() => {
    vpn.GetSettings().then(cfg => {
      if (cfg.autoConnect && cfg.autoConnectProfileId) setActiveTab('connection');
    }).catch(() => {});
    vpn.GetCurrentVersion().then(v => setVersion(v)).catch(() => {});
  }, []);

  // Wrap disconnect: fire immediately, but hold the animation for the full duration
  const handleDisconnect = useCallback(() => {
    setDisconnecting(true);
    setActiveTab('connection');
    vpn.disconnect(); // fires right away
    setTimeout(() => {
      setDisconnecting(false);
    }, DISC_ANIM_MS);
  }, [vpn.disconnect]);

  const activeProfile = vpn.profiles.find(p => p.id === vpn.activeProfileId);

  // Keyboard shortcuts: 1-4 switch tabs, c connect, d disconnect
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) { setActiveTab(TAB_ORDER[n - 1]); return; }
      if (e.key === 'c' && vpn.status === 'disconnected' && !disconnecting && vpn.activeProfileId) {
        vpn.connect(vpn.activeProfileId);
      }
      if (e.key === 'd' && !disconnecting &&
          (vpn.status === 'connected' || vpn.status === 'connecting' || vpn.status === 'reconnecting')) {
        handleDisconnect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [vpn.status, vpn.activeProfileId, disconnecting, handleDisconnect, vpn.connect]);

  const showActions = activeTab === 'profiles' || activeTab === 'connection';

  const modeWord = disconnecting ? 'TERM'
                 : vpn.status === 'connected' ? 'LINK'
                 : (vpn.status === 'connecting' || vpn.status === 'reconnecting') ? 'SYNC'
                 : 'IDLE';
  const modeCls  = disconnecting ? 'term'
                 : vpn.status === 'connected' ? 'link'
                 : (vpn.status === 'connecting' || vpn.status === 'reconnecting') ? 'sync'
                 : 'idle';

  return (
    <div id="app-inner">
      <UpdateBanner vpn={vpn} />
      <ChangelogModal vpn={vpn} version={version} />
      <Header status={vpn.status} disconnecting={disconnecting} />
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'profiles'   && <ProfilesTab vpn={vpn} />}
      {activeTab === 'connection' && <ConnectionTab vpn={vpn} disconnecting={disconnecting} />}
      {activeTab === 'audit'      && <AuditTab vpn={vpn} />}
      {activeTab === 'settings'   && <SettingsTab vpn={vpn} />}

      {showActions && (
        <ActionRow
          status={vpn.status}
          disconnecting={disconnecting}
          activeProfileId={vpn.activeProfileId}
          profileName={activeProfile?.name}
          onConnect={() => vpn.connect(vpn.activeProfileId)}
          onDisconnect={handleDisconnect}
          appendLog={vpn.appendLog}
        />
      )}

      <footer className="statusline">
        <span className={`sl-mode ${modeCls}`}>{modeWord}</span>
        <span className="sl-seg">{activeProfile ? activeProfile.name : 'no profile'}</span>
        <span className="sl-spacer" />
        <span className="sl-seg sl-keys">1-4 · c · d</span>
        <span className="sl-seg">♥ uriel</span>
        <span className="sl-seg sl-ver">{version}</span>
      </footer>
    </div>
  );
}
