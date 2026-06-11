const TABS = [
  { id: 'profiles',   label: 'profiles', key: '1' },
  { id: 'connection', label: 'session',  key: '2' },
  { id: 'audit',      label: 'audit',    key: '3' },
  { id: 'settings',   label: 'config',   key: '4' },
];

export default function TabBar({ activeTab, setActiveTab }) {
  return (
    <nav className="tabs">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`tab${activeTab === t.id ? ' active' : ''}`}
          onClick={() => setActiveTab(t.id)}
        >
          <span className="tab-key">{t.key}</span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
