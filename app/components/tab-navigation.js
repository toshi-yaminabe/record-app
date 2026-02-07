'use client'

export function TabNavigation({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
          {tab.badge && <span className="badge">{tab.badge}</span>}
        </button>
      ))}
    </nav>
  )
}
