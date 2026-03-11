import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Mail, Calendar, CheckSquare, MessageSquare,
  Bot, Search, Settings, Zap, ChevronRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard',  badge: null },
  { id: 'email',     icon: Mail,            label: 'Email',       badge: 3 },
  { id: 'calendar',  icon: Calendar,        label: 'Calendar',    badge: null },
  { id: 'tasks',     icon: CheckSquare,     label: 'Tasks',       badge: 5 },
  { id: 'chat',      icon: MessageSquare,   label: 'AI Chat',     badge: null },
  { id: 'agents',    icon: Bot,             label: 'Agents',      badge: null },
  { id: 'research',  icon: Search,          label: 'Research',    badge: null },
];

function Sidebar({ currentView, onNavigate, agentStatus }) {
  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        height: '100vh',
        background: 'var(--s1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
              flexShrink: 0,
            }}
          >
            <Zap size={16} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>Fabric AI</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.2 }}>Personal OS</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 8px 6px' }}>
            WORKSPACE
          </p>
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.id}
              item={item}
              isActive={currentView === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 8px' }}>
        <NavItem
          item={{ id: 'settings', icon: Settings, label: 'Settings', badge: null }}
          isActive={currentView === 'settings'}
          onClick={() => onNavigate('settings')}
        />

        {/* Agent Status */}
        <div
          style={{
            margin: '8px 4px 2px',
            padding: '10px 12px',
            background: agentStatus.connected ? 'rgba(34,197,94,0.06)' : 'rgba(161,161,170,0.06)',
            borderRadius: 10,
            border: `1px solid ${agentStatus.connected ? 'rgba(34,197,94,0.15)' : 'var(--border)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>Agent Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: agentStatus.connected ? 'var(--green)' : 'var(--s5)',
                  boxShadow: agentStatus.connected ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
                  display: 'block',
                  animation: agentStatus.connected ? 'pulseDot 2s ease-in-out infinite' : 'none',
                }}
              />
              <span style={{ fontSize: 11, color: agentStatus.connected ? 'var(--green)' : 'var(--text-3)' }}>
                {agentStatus.connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          {agentStatus.connected && agentStatus.activeAgents?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {agentStatus.activeAgents.map(a => (
                <span key={a} className="badge badge-green" style={{ fontSize: 10 }}>{a}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ x: 1 }}
      whileTap={{ scale: 0.98 }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '8px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        border: 'none',
        background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
        color: isActive ? '#818cf8' : 'var(--text-2)',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        textAlign: 'left',
        transition: 'background 0.15s, color 0.15s',
        position: 'relative',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--s4)';
          e.currentTarget.style.color = 'var(--text-1)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-2)';
        }
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.span
          layoutId="activeBar"
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 16,
            borderRadius: 99,
            background: '#6366f1',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      <Icon size={15} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 99,
            background: isActive ? 'rgba(99,102,241,0.3)' : 'rgba(239,68,68,0.15)',
            color: isActive ? '#818cf8' : '#f87171',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {item.badge}
        </span>
      )}
    </motion.button>
  );
}

export default Sidebar;
