import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Mail, Calendar, CheckSquare, Search, DollarSign,
  RefreshCw, Activity, CheckCircle2, AlertCircle,
  PlayCircle, PauseCircle, ChevronRight, Zap,
  Send, Inbox, Clock, TrendingUp, Wifi, WifiOff,
  RotateCcw, Sparkles, ArrowRight,
} from 'lucide-react';

// ── Static agent definitions (always visible, even before backend connects) ──

const AGENT_DEFS = [
  {
    id: 'email_agent',
    label: 'Email Agent',
    icon: Mail,
    color: '#3b82f6',
    description: 'Triages inbox, drafts replies, detects urgent emails',
    actions: [
      { label: 'Triage Inbox',   cmd: 'triage_inbox',   agent: 'email_agent' },
      { label: 'Inbox Summary',  intent: 'inbox_summary', agent: 'email_agent' },
    ],
  },
  {
    id: 'calendar_agent',
    label: 'Calendar Agent',
    icon: Calendar,
    color: '#8b5cf6',
    description: "Fetches events, preps meeting briefs, detects conflicts",
    actions: [
      { label: "Today's Meetings",    intent: 'get_today_meetings',    agent: 'calendar_agent' },
      { label: "Tomorrow's Meetings", intent: 'get_tomorrow_meetings', agent: 'calendar_agent' },
    ],
  },
  {
    id: 'task_agent',
    label: 'Task Agent',
    icon: CheckSquare,
    color: '#22c55e',
    description: 'Prioritises tasks, surfaces deadlines, creates follow-ups',
    actions: [
      { label: 'High Priority Tasks', intent: 'surface_high_priority_tasks', agent: 'task_agent' },
      { label: 'Overdue Tasks',       intent: 'surface_overdue_tasks',        agent: 'task_agent' },
    ],
  },
  {
    id: 'research_agent',
    label: 'Research Agent',
    icon: Search,
    color: '#f59e0b',
    description: 'Searches the web, summarises findings, researches contacts',
    actions: [
      { label: 'Research Topic', intent: 'summarize_topic', agent: 'research_agent', prompt: true },
    ],
  },
  {
    id: 'finance_agent',
    label: 'Finance Agent',
    icon: DollarSign,
    color: '#06b6d4',
    description: 'Tracks expenses, monitors budgets, flags overspend',
    actions: [
      { label: 'Expense Summary',   intent: 'expense_summary',   agent: 'finance_agent' },
      { label: 'Budget Alerts',     intent: 'budget_alert',      agent: 'finance_agent' },
    ],
  },
  {
    id: 'assistant_agent',
    label: 'AI Assistant',
    icon: Bot,
    color: '#6366f1',
    description: 'Your AI chief of staff — plans workflows, answers anything',
    actions: [],
  },
];

const WORKFLOWS = [
  { id: 'morning_routine',      label: 'Morning Briefing',        icon: '☀️', description: 'Calendar + email + tasks → full morning brief' },
  { id: 'prepare_for_tomorrow', label: 'Prepare for Tomorrow',    icon: '📋', description: 'Research participants, surface related emails & tasks' },
  { id: 'handle_inbox',         label: 'Handle Inbox',            icon: '📥', description: 'Triage emails then auto-create follow-up tasks' },
  { id: 'daily_summary',        label: 'Daily Summary',           icon: '🌙', description: 'Email + calendar + overdue tasks → end-of-day report' },
];

const STATUS_COLOR = {
  idle:      '#52525b',
  running:   '#22c55e',
  waiting:   '#f59e0b',
  completed: '#22c55e',
  failed:    '#ef4444',
  paused:    '#52525b',
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pulse(color) {
  return {
    width: 8, height: 8, borderRadius: '50%',
    backgroundColor: color,
    boxShadow: `0 0 0 2px ${color}40`,
  };
}

function ts(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPip({ status }) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.idle;
  const isActive = status === 'running' || status === 'waiting';
  return (
    <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
      {isActive && (
        <motion.div
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ ...pulse(color), position: 'absolute', inset: 0 }}
        />
      )}
      <div style={pulse(color)} />
    </div>
  );
}

function AgentCard({ def, live, selected, onClick, onAction, running }) {
  const Icon = def.icon;
  const status = live?.status || 'idle';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const currentTask = live?.current_task_label;
  const tasksCompleted = live?.tasks_completed ?? 0;
  const successRate = live?.success_rate ?? 100;
  const isSelected = selected;
  const isPaused = status === 'paused';

  return (
    <motion.div
      variants={fadeUp}
      onClick={onClick}
      style={{
        background: isSelected ? 'var(--accent-s)' : 'var(--s2)',
        border: `1px solid ${isSelected ? 'var(--accent-b)' : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)',
        padding: '16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            background: `${def.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon size={17} color={def.color} />
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.3 }}>{def.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <StatusPip status={status} />
              <span style={{ fontSize: 11, color: STATUS_COLOR[status] || 'var(--text-3)' }}>{statusLabel}</span>
            </div>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isSelected ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight size={14} color="var(--text-3)" />
        </motion.div>
      </div>

      {/* Current task badge */}
      {currentTask && status === 'running' && (
        <div style={{
          background: `${def.color}12`, border: `1px solid ${def.color}25`,
          borderRadius: 'var(--r-sm)', padding: '4px 8px', marginBottom: 10,
        }}>
          <p style={{ fontSize: 11, color: def.color, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTask}
          </p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {[
          { label: 'Done', value: tasksCompleted },
          { label: 'Rate', value: `${successRate}%` },
          { label: 'Status', value: statusLabel },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--s1)', borderRadius: 'var(--r-sm)',
            padding: '6px 4px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{value}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AgentDetail({ def, live, onPause, onResume, onAction, onClose, running }) {
  const Icon = def.icon;
  const status = live?.status || 'idle';
  const isPaused = status === 'paused';
  const logs = live?.activity_log || [];
  const [prompt, setPrompt] = useState('');
  const [promptAction, setPromptAction] = useState(null);
  const logsRef = useRef(null);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs.length]);

  const logColor = (level) => {
    if (level === 'error') return 'var(--red)';
    if (level === 'warning') return 'var(--amber)';
    return 'var(--text-2)';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.22 }}
      style={{
        background: 'var(--s2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', padding: 20,
        display: 'flex', flexDirection: 'column', height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--r-md)',
            background: `${def.color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={18} color={def.color} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{def.label}</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{def.description}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, lineHeight: 1, padding: 4 }}
        >×</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
        {[
          { label: 'Tasks Done', value: live?.tasks_completed ?? 0, color: '#22c55e' },
          { label: 'Success Rate', value: `${live?.success_rate ?? 100}%`, color: 'var(--accent)' },
          { label: 'Failed', value: live?.tasks_failed ?? 0, color: live?.tasks_failed > 0 ? 'var(--red)' : 'var(--text-3)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: 'var(--s3)', borderRadius: 'var(--r)', padding: '10px 8px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color }}>{value}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {live?.error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--r)', padding: '8px 10px', marginBottom: 14,
        }}>
          <p style={{ fontSize: 11, color: 'var(--red)' }}>{live.error}</p>
        </div>
      )}

      {/* Quick actions */}
      {def.actions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Quick Actions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {def.actions.map(action => (
              <div key={action.label}>
                {action.prompt ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      placeholder={`Topic to research…`}
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && prompt && onAction(action, { topic: prompt })}
                      style={{
                        flex: 1, background: 'var(--s1)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)', padding: '6px 10px',
                        color: 'var(--text-1)', fontSize: 12, outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => prompt && onAction(action, { topic: prompt })}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--r-sm)',
                        background: 'var(--accent)', border: 'none',
                        color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}
                    >Go</button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAction(action, {})}
                    disabled={running}
                    style={{
                      width: '100%', padding: '7px 12px',
                      background: 'var(--s3)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)', color: 'var(--text-2)',
                      fontSize: 12, cursor: running ? 'not-allowed' : 'pointer',
                      textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      opacity: running ? 0.5 : 1, transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => !running && (e.currentTarget.style.background = 'var(--s4)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--s3)')}
                  >
                    <span>{action.label}</span>
                    <ArrowRight size={12} color="var(--text-3)" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity log */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
          Activity Log
        </p>
        <div
          ref={logsRef}
          style={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
            background: 'var(--s1)', borderRadius: 'var(--r)', padding: '8px 10px',
          }}
        >
          {logs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', textAlign: 'center', marginTop: 16 }}>
              No activity yet — run an action to see logs here
            </p>
          ) : (
            [...logs].reverse().map((log, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>
                  {ts(log.ts)}
                </span>
                <span style={{ fontSize: 11, color: logColor(log.level), lineHeight: 1.5 }}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          onClick={isPaused ? onResume : onPause}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--r)',
            border: `1px solid ${isPaused ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            background: isPaused ? 'rgba(34,197,94,0.1)' : 'var(--s3)',
            color: isPaused ? '#22c55e' : 'var(--text-2)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {isPaused ? <><PlayCircle size={13} /> Resume</> : <><PauseCircle size={13} /> Pause</>}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentMonitor() {
  const [liveAgents, setLiveAgents] = useState({});   // keyed by agent name
  const [selected, setSelected] = useState(null);
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [eventFeed, setEventFeed] = useState([]);     // global event stream
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatPending, setChatPending] = useState(false);
  const feedRef = useRef(null);
  const pollRef = useRef(null);
  const pendingTimeoutRef = useRef(null);

  const addFeedEvent = useCallback((msg, type = 'info') => {
    setEventFeed(prev => [
      { id: Date.now() + Math.random(), msg, type, ts: new Date().toISOString() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Merge live agent data into state
  const mergeAgent = useCallback((payload) => {
    if (!payload?.agent_id) return;
    setLiveAgents(prev => ({ ...prev, [payload.agent_id]: { ...prev[payload.agent_id], ...payload } }));
  }, []);

  // Poll backend for agent states (primary data source, reliable)
  const fetchAgents = useCallback(async () => {
    try {
      const result = await window.electronAPI?.sendCommand?.('get_agents');
      if (result?.success && Array.isArray(result.result?.agents)) {
        const map = {};
        result.result.agents.forEach(a => { map[a.agent_id || a.name] = a; });
        setLiveAgents(map);
        setConnected(true);
      }
    } catch (_) {}

    try {
      const status = await window.electronAPI?.getAgentStatus?.();
      if (status?.connected !== undefined) setConnected(!!status.connected);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchAgents();
    pollRef.current = setInterval(fetchAgents, 4000);

    // WebSocket overlay — real-time enrichment on top of polling
    const unsub = window.electronAPI?.onAgentUpdate?.((msg) => {
      if (!msg) return;

      if (msg.type === 'init' && Array.isArray(msg.agents)) {
        const map = {};
        msg.agents.forEach(a => { map[a.name] = a; });
        setLiveAgents(map);
        setConnected(true);
        return;
      }

      if (msg.type === 'event') {
        const et = msg.event_type;
        if (et === 'agent.state_changed' && msg.payload) {
          mergeAgent(msg.payload);
        }

        // Route assistant_agent task results back to the chat UI
        if (et === 'task.result' && msg.payload?.agent === 'assistant_agent') {
          const response = msg.payload?.result?.response || (msg.payload?.success ? 'Done.' : (msg.payload?.error || 'Something went wrong.'));
          clearTimeout(pendingTimeoutRef.current);
          setChatHistory(prev => {
            const lastPending = [...prev].reverse().findIndex(m => m.pending);
            if (lastPending >= 0) {
              const idx = prev.length - 1 - lastPending;
              return [...prev.slice(0, idx), { role: 'assistant', content: response }, ...prev.slice(idx + 1)];
            }
            return [...prev, { role: 'assistant', content: response }];
          });
          setChatPending(false);
          addFeedEvent('🤖 Assistant responded', 'success');
        }

        // Surface interesting events in the feed
        const feedTypes = {
          'inbox.triaged': '📧 Inbox triaged',
          'task.created': '✅ Task created',
          'task.completed': '✅ Task completed',
          'meeting.scheduled': '📅 Meeting scheduled',
          'research.completed': '🔍 Research completed',
          'workflow.completed': '🎯 Workflow completed',
          'agent.failed': '⚠️ Agent failed',
          'task.result': '✓ Agent task complete',
        };
        if (feedTypes[et] && et !== 'task.result') {
          addFeedEvent(`${feedTypes[et]}${msg.payload ? ` — ${JSON.stringify(msg.payload).slice(0, 60)}` : ''}`, et === 'agent.failed' ? 'error' : 'success');
        }
      }

      if (msg.type === 'agents' && Array.isArray(msg.agents)) {
        const map = {};
        msg.agents.forEach(a => { map[a.name] = a; });
        setLiveAgents(map);
        setConnected(true);
      }
    });

    return () => {
      clearInterval(pollRef.current);
      clearTimeout(pendingTimeoutRef.current);
      unsub?.();
    };
  }, [fetchAgents, mergeAgent, addFeedEvent]);

  const handleAction = async (action, params = {}) => {
    setRunning(true);
    addFeedEvent(`▶ Running: ${action.label}`, 'running');
    try {
      const result = await window.electronAPI?.sendCommand?.('get_agents'); // refresh after
      if (action.cmd) {
        await window.electronAPI?.sendCommand?.(action.cmd, params);
      } else {
        await window.electronAPI?.sendCommand?.('get_summary'); // ping to keep awake
        // Dispatch via WS
        await window.electronAPI?.sendAgentCommand?.(action.intent, { ...params, agent_name: action.agent });
      }
      addFeedEvent(`✓ ${action.label} dispatched`, 'success');
      setTimeout(fetchAgents, 1500);
    } catch (e) {
      addFeedEvent(`✗ ${action.label} failed: ${e.message}`, 'error');
    }
    setRunning(false);
  };

  const handleWorkflow = async (workflow) => {
    setRunning(true);
    addFeedEvent(`▶ Workflow: ${workflow.label}`, 'running');
    try {
      await window.electronAPI?.sendCommand?.('run_workflow', { workflow: workflow.id });
      addFeedEvent(`✓ ${workflow.label} started — agents are working…`, 'success');
      setTimeout(fetchAgents, 2000);
    } catch (e) {
      addFeedEvent(`✗ Workflow failed: ${e.message}`, 'error');
    }
    setRunning(false);
  };

  const handlePause = async (agentName) => {
    await window.electronAPI?.pauseAgent?.(agentName);
    addFeedEvent(`⏸ ${agentName} paused`, 'info');
    setTimeout(fetchAgents, 800);
  };

  const handleResume = async (agentName) => {
    await window.electronAPI?.resumeAgent?.(agentName);
    addFeedEvent(`▶ ${agentName} resumed`, 'info');
    setTimeout(fetchAgents, 800);
  };

  const handleChat = async () => {
    if (!chatInput.trim() || chatPending) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '…', pending: true }]);
    setChatPending(true);
    addFeedEvent(`💬 Chat: "${msg.slice(0, 60)}"`, 'info');

    // Fallback: if no task.result arrives within 30s, show a timeout message
    pendingTimeoutRef.current = setTimeout(() => {
      setChatHistory(prev => {
        const lastPending = [...prev].reverse().findIndex(m => m.pending);
        if (lastPending < 0) return prev;
        const idx = prev.length - 1 - lastPending;
        return [...prev.slice(0, idx), { role: 'assistant', content: 'The backend took too long to respond. Check that the Python server is running.' }, ...prev.slice(idx + 1)];
      });
      setChatPending(false);
    }, 30000);

    try {
      // Use the dedicated chat channel — routes directly to assistant_agent
      await window.electronAPI?.sendChatMessage?.(msg);
    } catch (e) {
      clearTimeout(pendingTimeoutRef.current);
      setChatHistory(prev => {
        const lastPending = [...prev].reverse().findIndex(m => m.pending);
        if (lastPending < 0) return [...prev, { role: 'assistant', content: `Error: ${e.message}` }];
        const idx = prev.length - 1 - lastPending;
        return [...prev.slice(0, idx), { role: 'assistant', content: `Error: ${e.message}` }, ...prev.slice(idx + 1)];
      });
      setChatPending(false);
    }
  };

  const selectedDef = AGENT_DEFS.find(d => d.id === selected);
  const selectedLive = selected ? (liveAgents[selected] || {}) : null;

  const activeCount = Object.values(liveAgents).filter(a => a.status === 'running').length;
  const totalDone = Object.values(liveAgents).reduce((s, a) => s + (a.tasks_completed || 0), 0);
  const avgRate = Object.values(liveAgents).length > 0
    ? Math.round(Object.values(liveAgents).reduce((s, a) => s + (a.success_rate || 100), 0) / Object.values(liveAgents).length)
    : 100;

  const feedColor = (type) => {
    if (type === 'error') return 'var(--red)';
    if (type === 'success') return 'var(--green)';
    if (type === 'running') return 'var(--accent)';
    return 'var(--text-3)';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--s0)', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Left column: agents + workflows ─────────────────────────────── */}
        <div style={{
          width: selected ? 300 : 360, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          transition: 'width 0.25s var(--ease-spring)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Agents</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  {connected
                    ? <><Wifi size={11} color="var(--green)" /><span style={{ fontSize: 11, color: 'var(--green)' }}>Live</span></>
                    : <><WifiOff size={11} color="var(--text-3)" /><span style={{ fontSize: 11, color: 'var(--text-3)' }}>Offline</span></>}
                </div>
              </div>
              <button
                onClick={() => { fetchAgents(); addFeedEvent('↺ Refreshed agent states'); }}
                style={{
                  padding: '6px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)',
                  background: 'var(--s2)', cursor: 'pointer', color: 'var(--text-3)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {[
                { label: 'Active', value: activeCount, color: activeCount > 0 ? 'var(--green)' : 'var(--text-1)' },
                { label: 'Done', value: totalDone, color: 'var(--text-1)' },
                { label: 'Rate', value: `${avgRate}%`, color: 'var(--accent)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', padding: '8px 4px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color }}>{value}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Agent list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0' }}>
            <motion.div variants={stagger} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AGENT_DEFS.map(def => (
                <AgentCard
                  key={def.id}
                  def={def}
                  live={liveAgents[def.id]}
                  selected={selected === def.id}
                  onClick={() => setSelected(selected === def.id ? null : def.id)}
                  onAction={handleAction}
                  running={running}
                />
              ))}
            </motion.div>

            {/* Workflows section */}
            <div style={{ marginTop: 20, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, padding: '0 4px' }}>
                Multi-Agent Workflows
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {WORKFLOWS.map(wf => (
                  <button
                    key={wf.id}
                    onClick={() => handleWorkflow(wf)}
                    disabled={running}
                    style={{
                      width: '100%', padding: '10px 12px',
                      background: 'var(--s2)', border: '1px solid var(--border)',
                      borderRadius: 'var(--r)', cursor: running ? 'not-allowed' : 'pointer',
                      textAlign: 'left', opacity: running ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => !running && (e.currentTarget.style.background = 'var(--s3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--s2)')}
                  >
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                        {wf.label}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{wf.description}</p>
                    </div>
                    <Zap size={13} color="var(--accent)" style={{ flexShrink: 0, marginLeft: 8 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Middle: agent detail (when selected) ────────────────────────── */}
        <AnimatePresence>
          {selected && selectedDef && (
            <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
              <AgentDetail
                def={selectedDef}
                live={selectedLive}
                onPause={() => handlePause(selected)}
                onResume={() => handleResume(selected)}
                onAction={handleAction}
                onClose={() => setSelected(null)}
                running={running}
              />
            </div>
          )}
        </AnimatePresence>

        {/* ── Right: command centre ────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat with assistant */}
          <div style={{ padding: '24px 24px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--r)', background: 'var(--accent-s)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={14} color="var(--accent)" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Tell your agents what to do</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Natural language · the Assistant Agent will coordinate</p>
              </div>
            </div>

            {/* Chat history */}
            {chatHistory.length > 0 && (
              <div style={{ marginBottom: 10, maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chatHistory.slice(-6).map((m, i) => (
                  <div key={i} style={{
                    padding: '7px 10px', borderRadius: 'var(--r)',
                    background: m.role === 'user' ? 'var(--accent-s)' : 'var(--s2)',
                    border: `1px solid ${m.role === 'user' ? 'var(--accent-b)' : 'var(--border)'}`,
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    opacity: m.pending ? 0.6 : 1,
                  }}>
                    {m.pending ? (
                      <motion.p
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}
                      >thinking…</motion.p>
                    ) : (
                      <p style={{ fontSize: 12, color: m.role === 'user' ? 'var(--accent)' : 'var(--text-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ display: 'flex', gap: 8, paddingBottom: 16 }}>
              <input
                placeholder='e.g. "Prepare me for tomorrow" or "Triage my inbox and create follow-up tasks"'
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                style={{
                  flex: 1, padding: '9px 14px',
                  background: 'var(--s2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r)', color: 'var(--text-1)',
                  fontSize: 13, outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-b)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                onClick={handleChat}
                disabled={!chatInput.trim() || chatPending}
                style={{
                  padding: '9px 16px', borderRadius: 'var(--r)',
                  background: chatInput.trim() && !chatPending ? 'var(--accent)' : 'var(--s2)',
                  border: 'none', color: chatInput.trim() && !chatPending ? '#fff' : 'var(--text-3)',
                  cursor: chatInput.trim() && !chatPending ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
                  minWidth: 80, justifyContent: 'center',
                }}
              >
                {chatPending
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><RefreshCw size={13} /></motion.div>
                  : <><Send size={13} /> Send</>}
              </button>
            </div>
          </div>

          {/* Live event feed */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '16px 24px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} color="var(--text-3)" />
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Live Event Feed
                </p>
              </div>
              {eventFeed.length > 0 && (
                <button
                  onClick={() => setEventFeed([])}
                  style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>

            <div style={{
              flex: 1, overflowY: 'auto',
              background: 'var(--s1)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg)', padding: '12px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {eventFeed.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)' }}>
                  <Activity size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
                  <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>No events yet</p>
                  <p style={{ fontSize: 12, textAlign: 'center', maxWidth: 240, lineHeight: 1.5 }}>
                    Run a workflow or trigger an agent action — events will stream here in real time
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {eventFeed.map(ev => (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                    >
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace', flexShrink: 0, marginTop: 2 }}>
                        {ts(ev.ts)}
                      </span>
                      <span style={{ fontSize: 12, color: feedColor(ev.type), lineHeight: 1.5 }}>{ev.msg}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Connection hint if offline */}
            {!connected && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={13} color="var(--amber)" />
                <p style={{ fontSize: 12, color: 'var(--amber)' }}>
                  Backend not connected — start the Python server to see live agents
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
