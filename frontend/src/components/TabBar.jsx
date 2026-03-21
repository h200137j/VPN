const TABS = [
  { id: 'profiles',   label: 'Profiles',   icon: '⚡' },
  { id: 'connection', label: 'Connection', icon: '🛡' },
  { id: 'audit',      label: 'Audit',      icon: '📋' },
  { id: 'settings',   label: 'Settings',   icon: '⚙️' },
];

export default function TabBar({ activeTab, setActiveTab }) {
  return (
    <div className="tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab${activeTab === t.id ? ' active' : ''}`}
          onClick={() => setActiveTab(t.id)}
        >
          <span className="tab-icon">{t.icon}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
