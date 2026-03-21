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

export default function App() {
  const vpn = useVPN();
  const [activeTab, setActiveTab]     = useState('profiles');
  const [version, setVersion]         = useState('dev');
  const [disconnecting, setDisconnecting] = useState(false);

  // Switch to connection tab whenever VPN is active
  useEffect(() => {
    if (vpn.status === 'connecting' || vpn.status === 'connected' || vpn.status === 'reconnecting') {
      setActiveTab('connection');
      setDisconnecting(false);
    }
    // Don't clear disconnecting here — the timer in handleDisconnect owns that
  }, [vpn.status]);

  // On first load, pre-switch to connection tab if auto-connect is on
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

  const showActions = activeTab === 'profiles' || activeTab === 'connection';

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
          onConnect={() => vpn.connect(vpn.activeProfileId)}
          onDisconnect={handleDisconnect}
          appendLog={vpn.appendLog}
        />
      )}

      <div className="footer">
        made with ❤️ by uriel &nbsp;·&nbsp; <span>{version}</span>
      </div>
    </div>
  );
}
