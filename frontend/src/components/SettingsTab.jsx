import { useState, useEffect } from 'react';

export default function SettingsTab({ vpn }) {
  const [autoConnect, setAutoConnect]   = useState(false);
  const [profileId, setProfileId]       = useState('');
  const [launchOnLogin, setLaunchOnLogin] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    vpn.GetSettings().then(cfg => {
      setAutoConnect(cfg.autoConnect || false);
      setProfileId(cfg.autoConnectProfileId || '');
      setLaunchOnLogin(cfg.launchOnLogin || false);
      setStartMinimized(cfg.startMinimized || false);
    }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await vpn.SaveSettings(autoConnect, profileId, launchOnLogin, startMinimized);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      vpn.appendLog('settings error: ' + e, 'error');
    }
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <span className="section-label">// config</span>
      </div>

      <div className="settings-group">
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">auto_connect</div>
            <div className="setting-desc">connect automatically when the app starts</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={autoConnect} onChange={e => setAutoConnect(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        {autoConnect && (
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-label">auto_connect_profile</div>
            </div>
            <select
              className="setting-select"
              value={profileId}
              onChange={e => setProfileId(e.target.value)}
            >
              <option value="">— select —</option>
              {vpn.profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">launch_on_login</div>
            <div className="setting-desc">start govpn automatically when you log in</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={launchOnLogin} onChange={e => setLaunchOnLogin(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">start_minimized</div>
            <div className="setting-desc">hide window on launch, live in the tray</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={startMinimized} onChange={e => setStartMinimized(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="add-actions">
        <button className="btn-primary" onClick={save}>
          {saved ? '✓ written' : ':wq save'}
        </button>
      </div>
    </div>
  );
}
