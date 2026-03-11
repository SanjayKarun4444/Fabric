import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Clock, Palette, Power, Info, Save, Check, Key, Bot, Shield } from 'lucide-react';

const SECTIONS = [
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'schedules',     label: 'Schedules',     icon: Clock },
  { id: 'appearance',    label: 'Appearance',    icon: Palette },
  { id: 'agents',        label: 'AI Agents',     icon: Bot },
  { id: 'integrations',  label: 'Integrations',  icon: Key },
  { id: 'startup',       label: 'Startup',       icon: Power },
  { id: 'about',         label: 'About',         icon: Info },
];

const DEFAULT_SETTINGS = {
  notifications: { email: true, calendar: true, tasks: true, agents: true },
  schedules: { morningRoutine: '07:00', eveningRoutine: '18:00', emailCheck: 15 },
  appearance: { theme: 'dark', accentColor: 'indigo', compactMode: false, animations: true },
  agents: { autoStart: true, logLevel: 'info', maxParallel: 3 },
  integrations: { gmail: true, googleCalendar: true, notion: false, slack: false },
  autoLaunch: false,
};

export default function SettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState('notifications');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI?.getSettings?.();
      if (result?.success && result.settings) {
        setSettings(s => ({ ...s, ...result.settings }));
      }
    } catch (_) {}
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI?.saveSettings?.(settings);
    } catch (_) {}
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--s0)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--s4)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* Sidebar nav */}
      <div style={{ width: 200, borderRight: '1px solid var(--border)', background: 'var(--s1)', padding: '20px 10px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', padding: '0 6px', marginBottom: 16 }}>Settings</h1>
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 8, border: 'none',
                background: isActive ? 'var(--accent-s)' : 'transparent',
                color: isActive ? '#818cf8' : 'var(--text-2)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', marginBottom: 2,
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--s4)'; e.currentTarget.style.color = 'var(--text-1)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; } }}
            >
              <Icon size={14} style={{ flexShrink: 0 }} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--s1)', flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
            {SECTIONS.find(s => s.id === activeSection)?.label}
          </h2>
          <motion.button
            whileTap={{ scale: 0.96 }}
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: 100 }}
          >
            {saved
              ? <><Check size={13} /> Saved!</>
              : saving
                ? <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} /> Saving…</>
                : <><Save size={13} /> Save Changes</>}
          </motion.button>
        </div>

        {/* Settings content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === 'notifications' && (
              <SettingsSection title="Notification Preferences" description="Choose when and how you want to be notified.">
                <ToggleRow
                  label="Email notifications"
                  description="Get notified about urgent and important emails"
                  checked={settings.notifications.email}
                  onChange={v => set('notifications', 'email', v)}
                />
                <ToggleRow
                  label="Calendar reminders"
                  description="Receive alerts before upcoming meetings"
                  checked={settings.notifications.calendar}
                  onChange={v => set('notifications', 'calendar', v)}
                />
                <ToggleRow
                  label="Task reminders"
                  description="Alerts for approaching task deadlines"
                  checked={settings.notifications.tasks}
                  onChange={v => set('notifications', 'tasks', v)}
                />
                <ToggleRow
                  label="Agent activity"
                  description="Notifications when agents complete important tasks"
                  checked={settings.notifications.agents}
                  onChange={v => set('notifications', 'agents', v)}
                />
              </SettingsSection>
            )}

            {activeSection === 'schedules' && (
              <SettingsSection title="Scheduled Routines" description="Automate your daily workflow with AI-powered routines.">
                <TimeRow
                  label="Morning routine"
                  description="Start your day with an AI-powered briefing"
                  value={settings.schedules.morningRoutine}
                  onChange={v => set('schedules', 'morningRoutine', v)}
                />
                <TimeRow
                  label="Evening wrap-up"
                  description="End-of-day summary and task review"
                  value={settings.schedules.eveningRoutine}
                  onChange={v => set('schedules', 'eveningRoutine', v)}
                />
                <NumberRow
                  label="Email check interval"
                  description="How often to scan for new emails (minutes)"
                  value={settings.schedules.emailCheck}
                  min={5} max={60}
                  onChange={v => set('schedules', 'emailCheck', Number(v))}
                />
              </SettingsSection>
            )}

            {activeSection === 'appearance' && (
              <SettingsSection title="Appearance" description="Customize the look and feel.">
                <SelectRow
                  label="Theme"
                  description="Choose your preferred color theme"
                  value={settings.appearance.theme}
                  options={[{ value: 'dark', label: 'Dark (recommended)' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System default' }]}
                  onChange={v => set('appearance', 'theme', v)}
                />
                <SelectRow
                  label="Accent color"
                  description="Primary highlight color throughout the app"
                  value={settings.appearance.accentColor}
                  options={[
                    { value: 'indigo', label: 'Indigo (default)' },
                    { value: 'blue', label: 'Blue' },
                    { value: 'purple', label: 'Purple' },
                    { value: 'green', label: 'Green' },
                  ]}
                  onChange={v => set('appearance', 'accentColor', v)}
                />
                <ToggleRow
                  label="Reduced motion"
                  description="Minimize animations and transitions"
                  checked={!settings.appearance.animations}
                  onChange={v => set('appearance', 'animations', !v)}
                />
                <ToggleRow
                  label="Compact mode"
                  description="Reduce spacing for a denser layout"
                  checked={settings.appearance.compactMode}
                  onChange={v => set('appearance', 'compactMode', v)}
                />
              </SettingsSection>
            )}

            {activeSection === 'agents' && (
              <SettingsSection title="AI Agent Configuration" description="Control how your AI agents operate.">
                <ToggleRow
                  label="Auto-start agents"
                  description="Automatically start agents when the app launches"
                  checked={settings.agents.autoStart}
                  onChange={v => set('agents', 'autoStart', v)}
                />
                <SelectRow
                  label="Log level"
                  description="Detail level for agent activity logging"
                  value={settings.agents.logLevel}
                  options={[
                    { value: 'error', label: 'Errors only' },
                    { value: 'warn',  label: 'Warnings' },
                    { value: 'info',  label: 'Info (default)' },
                    { value: 'debug', label: 'Debug (verbose)' },
                  ]}
                  onChange={v => set('agents', 'logLevel', v)}
                />
                <NumberRow
                  label="Max parallel agents"
                  description="Maximum number of agents running simultaneously"
                  value={settings.agents.maxParallel}
                  min={1} max={10}
                  onChange={v => set('agents', 'maxParallel', Number(v))}
                />
              </SettingsSection>
            )}

            {activeSection === 'integrations' && (
              <SettingsSection title="Connected Services" description="Manage connections to external services.">
                {[
                  { key: 'gmail',          label: 'Gmail',           sub: 'Read and manage emails' },
                  { key: 'googleCalendar', label: 'Google Calendar', sub: 'Access and update calendar events' },
                  { key: 'notion',         label: 'Notion',          sub: 'Sync tasks and notes' },
                  { key: 'slack',          label: 'Slack',           sub: 'Send notifications and messages' },
                ].map(({ key, label, sub }) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    description={sub}
                    checked={settings.integrations[key]}
                    onChange={v => set('integrations', key, v)}
                    badge={settings.integrations[key] ? 'Connected' : 'Disconnected'}
                    badgeColor={settings.integrations[key] ? 'green' : 'gray'}
                  />
                ))}
              </SettingsSection>
            )}

            {activeSection === 'startup' && (
              <SettingsSection title="Startup & System" description="Control system-level behavior.">
                <ToggleRow
                  label="Launch on system startup"
                  description="Automatically open when you log in to your computer"
                  checked={settings.autoLaunch}
                  onChange={v => setSettings(p => ({ ...p, autoLaunch: v }))}
                />
              </SettingsSection>
            )}

            {activeSection === 'about' && (
              <SettingsSection title="About Fabric AI" description="">
                <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
                      <span style={{ fontSize: 24 }}>⚡</span>
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Fabric AI</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Version 1.0.0 · Personal AI OS</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Version',   value: '1.0.0' },
                      { label: 'Build',     value: '2026.03.10' },
                      { label: 'Runtime',   value: 'Electron 28' },
                      { label: 'AI Model',  value: 'Claude 3.5' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => window.electronAPI?.checkForUpdates?.()}>
                      Check for updates
                    </button>
                    <button className="btn btn-ghost">View changelog</button>
                  </div>
                </div>
              </SettingsSection>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ─── Setting Primitives ─────────────────────────────────────── */

function SettingsSection({ title, description, children }) {
  return (
    <div>
      {(title || description) && (
        <div style={{ marginBottom: 24 }}>
          {title && <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{title}</h3>}
          {description && <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{description}</p>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, badge, badgeColor, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: 10, background: 'var(--s2)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: description ? 3 : 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{label}</span>
          {badge && (
            <span className={`badge badge-${badgeColor ?? 'gray'}`} style={{ fontSize: 10 }}>{badge}</span>
          )}
        </div>
        {description && <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>{description}</p>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 20 }}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, badge, badgeColor }) {
  return (
    <SettingRow label={label} description={description} badge={badge} badgeColor={badgeColor}>
      <Toggle checked={checked} onChange={onChange} />
    </SettingRow>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <motion.button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--accent)' : 'var(--s5)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        boxShadow: checked ? '0 0 8px rgba(99,102,241,0.4)' : 'none',
      }}
    >
      <motion.span
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: 3, left: 0,
          width: 16, height: 16, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </motion.button>
  );
}

function TimeRow({ label, description, value, onChange }) {
  return (
    <SettingRow label={label} description={description}>
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input"
        style={{ width: 110, height: 34, fontSize: 13, textAlign: 'center' }}
      />
    </SettingRow>
  );
}

function NumberRow({ label, description, value, min, max, onChange }) {
  return (
    <SettingRow label={label} description={description}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value)}
          className="input"
          style={{ width: 80, height: 34, fontSize: 13, textAlign: 'center' }}
        />
        {min != null && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{min}–{max}</span>}
      </div>
    </SettingRow>
  );
}

function SelectRow({ label, description, value, options, onChange }) {
  return (
    <SettingRow label={label} description={description}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input"
        style={{ width: 'auto', minWidth: 160, height: 34, fontSize: 13 }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </SettingRow>
  );
}
