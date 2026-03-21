import { useState, useEffect } from 'react';
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

export default function App() {
  const vpn = useVPN();
  const [activeTab, setActiveTab] = useState('profiles');
  const [version, setVersion] = useState('dev');

  useEffect(() => {
    if (vpn.status === 'connecting' || vpn.status === 'connected' || vpn.status === 'reconnecting') {
      setActiveTab('connection');
    }
  }, [vpn.status]);

  useEffect(() => {
    vpn.GetCurrentVersion().then(v => setVersion(v)).catch(() => {});
  }, []);

  const showActions = activeTab === 'profiles' || activeTab === 'connection';

  return (
    <div id="app-inner">
      <UpdateBanner vpn={vpn} />
      <ChangelogModal vpn={vpn} version={version} />
      <Header status={vpn.status} />
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'profiles'   && <ProfilesTab vpn={vpn} />}
      {activeTab === 'connection' && <ConnectionTab vpn={vpn} />}
      {activeTab === 'audit'      && <AuditTab vpn={vpn} />}
      {activeTab === 'settings'   && <SettingsTab vpn={vpn} />}

      {showActions && (
        <ActionRow
          status={vpn.status}
          activeProfileId={vpn.activeProfileId}
          onConnect={() => vpn.connect(vpn.activeProfileId)}
          onDisconnect={vpn.disconnect}
          appendLog={vpn.appendLog}
        />
      )}

      <div className="footer">
        made with ❤️ by uriel &nbsp;·&nbsp; <span>{version}</span>
      </div>
    </div>
  );
}
