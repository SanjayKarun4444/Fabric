import React from 'react';

function Sidebar({ currentView, onNavigate, agentStatus }) {
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'email', icon: '📧', label: 'Email' },
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { id: 'tasks', icon: '✅', label: 'Tasks' },
    { id: 'chat', icon: '💬', label: 'Chat' },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">🤖</span>
          <span className="logo-text">AI Agent</span>
        </div>
      </div>

      <div className="nav-items">
        {navItems.map(item => (
          <div
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span className="label">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div
          className="nav-item"
          onClick={() => onNavigate('settings')}
        >
          <span className="icon">⚙️</span>
          <span className="label">Settings</span>
        </div>
        
        <div className={`status-indicator ${agentStatus.connected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {agentStatus.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </nav>
  );
}

export default Sidebar;
