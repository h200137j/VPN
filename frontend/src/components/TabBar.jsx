import React from 'react';

const TABS = [
  { id: 'profiles',   label: 'Profiles' },
  { id: 'connection', label: 'Connection' },
  { id: 'audit',      label: 'Audit' },
  { id: 'settings',   label: 'Settings' },
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
          {t.label}
        </button>
      ))}
    </div>
  );
}
