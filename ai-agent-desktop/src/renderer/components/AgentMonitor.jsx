import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Mail, Calendar, CheckSquare, Search, DollarSign,
  RefreshCw, Activity, Zap, Clock, CheckCircle2,
  AlertCircle, PlayCircle, PauseCircle, RotateCcw, ChevronRight,
  TrendingUp, MessageSquare,
} from 'lucide-react';

const AGENTS = [
  {
    id: 'email',
    name: 'Email Agent',
    icon: Mail,
    color: '#3b82f6',
    status: 'active',
    description: 'Monitors inbox, triages emails, drafts replies',
    lastAction: '2 min ago',
    tasksToday: 24,
    successRate: 98,
    currentTask: 'Scanning inbox for urgent messages…',
    logs: [
      { time: '14:32', msg: 'Triaged 12 new emails', type: 'success' },
      { time: '14:28', msg: 'Drafted reply to Sarah Chen', type: 'success' },
      { time: '14:15', msg: 'Flagged 3 urgent emails', type: 'warning' },
      { time: '13:50', msg: 'Processed 8 newsletters', type: 'info' },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar Agent',
    icon: Calendar,
    color: '#22c55e',
    status: 'active',
    description: 'Manages schedule, prepares meeting briefs',
    lastAction: '5 min ago',
    tasksToday: 8,
    successRate: 100,
    currentTask: 'Preparing briefing for Q1 Planning meeting…',
    logs: [
      { time: '14:20', msg: 'Created meeting prep for Q1 Planning', type: 'success' },
      { time: '13:30', msg: 'Sent reminder: Team Standup in 10m', type: 'info' },
      { time: '11:00', msg: 'Joined Team Standup', type: 'success' },
    ],
  },
  {
    id: 'tasks',
    name: 'Task Agent',
    icon: CheckSquare,
    color: '#f59e0b',
    status: 'active',
    description: 'Prioritizes tasks, tracks deadlines',
    lastAction: '8 min ago',
    tasksToday: 15,
    successRate: 95,
    currentTask: 'Reprioritizing task list based on new emails…',
    logs: [
      { time: '14:10', msg: 'Reprioritized 5 tasks', type: 'success' },
      { time: '13:00', msg: 'Marked "Sprint notes" complete', type: 'success' },
      { time: '12:30', msg: 'Deadline alert: Contract review due today', type: 'warning' },
    ],
  },
  {
    id: 'research',
    name: 'Research Agent',
    icon: Search,
    color: '#a855f7',
    status: 'idle',
    description: 'Conducts research, summarizes findings',
    lastAction: '2 hours ago',
    tasksToday: 3,
    successRate: 92,
    currentTask: null,
    logs: [
      { time: '12:00', msg: 'Completed competitor analysis report', type: 'success' },
      { time: '10:30', msg: 'Summarized 5 industry articles', type: 'success' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance Agent',
    icon: DollarSign,
    color: '#06b6d4',
    status: 'idle',
    description: 'Tracks expenses, monitors budgets',
    lastAction: '1 hour ago',
    tasksToday: 5,
    successRate: 100,
    currentTask: null,
    logs: [
      { time: '13:15', msg: 'Generated Q1 expense summary', type: 'success' },
      { time: '11:45', msg: 'Budget alert: Travel 85% used', type: 'warning' },
    ],
  },
  {
    id: 'assistant',
    name: 'Personal Assistant',
    icon: MessageSquare,
    color: '#6366f1',
    status: 'active',
    description: 'Answers questions, orchestrates agents',
    lastAction: 'Just now',
    tasksToday: 32,
    successRate: 97,
    currentTask: 'Ready for your next request…',
    logs: [
      { time: '14:35', msg: 'Responded to chat query', type: 'success' },
      { time: '14:00', msg: 'Completed morning routine', type: 'success' },
    ],
  },
];

export default function AgentMonitor({ agentStatus, onCommand }) {
  const [agents, setAgents] = useState(AGENTS);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onCommand('ping');
    setTimeout(() => setRefreshing(false), 800);
  };

  const activeCount = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((s, a) => s + a.tasksToday, 0);
  const avgSuccess = Math.round(agents.reduce((s, a) => s + a.successRate, 0) / agents.length);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--s0)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
              Agent Monitor
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Real-time status of your AI agent network</p>
          </div>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* System stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Active Agents',  value: `${activeCount}/${agents.length}`, icon: Bot,         color: 'var(--green)',  bg: 'rgba(34,197,94,0.08)' },
            { label: 'Tasks Today',    value: totalTasks,                          icon: CheckSquare,  color: 'var(--accent)', bg: 'rgba(99,102,241,0.08)' },
            { label: 'Success Rate',   value: `${avgSuccess}%`,                    icon: TrendingUp,   color: 'var(--amber)',  bg: 'rgba(245,158,11,0.08)' },
            { label: 'System Status',  value: agentStatus.connected ? 'Online' : 'Offline',
              icon: Activity, color: agentStatus.connected ? 'var(--green)' : 'var(--red)',
              bg: agentStatus.connected ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card"
              style={{ padding: '16px 20px', background: 'var(--s2)' }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={15} color={color} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Agent grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
          {agents.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              delay={i * 0.05}
              isSelected={selectedAgent?.id === agent.id}
              onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
            />
          ))}
        </div>

        {/* Selected agent detail */}
        <AnimatePresence>
          {selectedAgent && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AgentCard({ agent, delay, isSelected, onClick }) {
  const Icon = agent.icon;
  const isActive = agent.status === 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="card"
      style={{
        padding: '18px 18px 16px',
        background: isSelected ? `${agent.color}0e` : 'var(--s2)',
        border: `1px solid ${isSelected ? `${agent.color}35` : 'var(--border)'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: `${agent.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={agent.color} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isActive ? 'var(--green)' : 'var(--s5)',
            boxShadow: isActive ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
            display: 'block',
            animation: isActive ? 'pulseDot 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 11, color: isActive ? 'var(--green)' : 'var(--text-3)', fontWeight: 500 }}>
            {isActive ? 'Active' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Name + desc */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{agent.name}</h3>
      <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4, marginBottom: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description}</p>

      {/* Current task */}
      {agent.currentTask && (
        <div style={{
          padding: '7px 10px', borderRadius: 7,
          background: isActive ? `${agent.color}0c` : 'var(--s3)',
          border: `1px solid ${isActive ? `${agent.color}20` : 'var(--border)'}`,
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: agent.color, animation: 'pulseDot 1.5s ease-in-out infinite', flexShrink: 0, display: 'block' }} />}
            <span style={{ fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.currentTask}
            </span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Today', value: agent.tasksToday, unit: '' },
          { label: 'Success', value: `${agent.successRate}`, unit: '%' },
          { label: 'Last run', value: agent.lastAction, unit: '' },
        ].map(({ label, value, unit }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{value}{unit}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AgentDetail({ agent, onClose }) {
  const Icon = agent.icon;
  const isActive = agent.status === 'active';
  const logColors = { success: 'var(--green)', warning: 'var(--amber)', error: 'var(--red)', info: 'var(--text-3)' };

  return (
    <div
      className="card card-elevated"
      style={{ padding: '24px', background: 'var(--s2)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${agent.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} color={agent.color} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{agent.name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{agent.description}</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Performance metrics */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>METRICS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MetricRow label="Tasks today" value={agent.tasksToday} max={50} color={agent.color} unit="" />
            <MetricRow label="Success rate" value={agent.successRate} max={100} color="var(--green)" unit="%" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Status</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: isActive ? 'var(--green)' : 'var(--text-3)', fontWeight: 500 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--green)' : 'var(--s5)' }} />
                {isActive ? 'Running' : 'Idle'}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
              {isActive ? <><PauseCircle size={12} /> Pause agent</> : <><PlayCircle size={12} /> Start agent</>}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
              <RotateCcw size={12} /> Restart
            </button>
          </div>
        </div>

        {/* Activity log */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>ACTIVITY LOG</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {agent.logs.map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, minWidth: 36 }}>{log.time}</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: logColors[log.type] ?? 'var(--s5)', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>{log.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, max, color, unit }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{value}{unit}</span>
      </div>
      <div style={{ height: 4, background: 'var(--s4)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: color, borderRadius: 99 }}
        />
      </div>
    </div>
  );
}
