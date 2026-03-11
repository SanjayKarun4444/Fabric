import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const CONFIG = {
  success: {
    icon: CheckCircle2,
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.25)',
    accent: '#22c55e',
    iconColor: '#4ade80',
    textColor: '#86efac',
  },
  error: {
    icon: XCircle,
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
    accent: '#ef4444',
    iconColor: '#f87171',
    textColor: '#fca5a5',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
    accent: '#f59e0b',
    iconColor: '#fbbf24',
    textColor: '#fde68a',
  },
  info: {
    icon: Info,
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.25)',
    accent: '#6366f1',
    iconColor: '#818cf8',
    textColor: '#c7d2fe',
  },
};

export default function Notification({ id, message, type = 'info', timestamp, onClose }) {
  const cfg = CONFIG[type] ?? CONFIG.info;
  const Icon = cfg.icon;

  const time = timestamp instanceof Date
    ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.border}`,
        minWidth: 280,
        maxWidth: 360,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 3,
        background: cfg.accent,
        borderRadius: '12px 0 0 12px',
      }} />

      {/* Icon */}
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon size={16} color={cfg.iconColor} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: cfg.textColor, lineHeight: 1.4, marginBottom: 2 }}>
          {message}
        </p>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{time}</span>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', flexShrink: 0, padding: 2,
          display: 'flex', alignItems: 'center', borderRadius: 4,
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
