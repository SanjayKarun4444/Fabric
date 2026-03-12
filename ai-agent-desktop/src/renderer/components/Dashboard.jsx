import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mail, Calendar, CheckSquare, Zap, RefreshCw,
  ArrowUpRight, Clock, TrendingUp, Inbox, Star,
  AlertCircle, Sun, Sunrise, Moon, Bot,
} from 'lucide-react';

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const cardVariant = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Good morning', icon: Sunrise };
  if (h < 18) return { text: 'Good afternoon', icon: Sun };
  return { text: 'Good evening', icon: Moon };
}

function Dashboard({ onCommand }) {
  const [summary, setSummary] = useState(null);
  const [urgentEmails, setUrgentEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { text: greeting, icon: GreetIcon } = getGreeting();

  useEffect(() => { loadSummary(); }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const [summaryResult, emailResult] = await Promise.all([
        window.electronAPI?.sendCommand?.('get_summary'),
        window.electronAPI?.sendCommand?.('get_emails', { max_results: 10 }),
      ]);
      if (summaryResult?.success) setSummary(summaryResult.result);
      if (emailResult?.success && emailResult.result?.emails) {
        const emails = emailResult.result.emails;
        // Show urgent first, then fill with most recent up to 4
        const urgent = emails.filter(e => e.priority === 'urgent');
        const normal = emails.filter(e => e.priority !== 'urgent');
        setUrgentEmails([...urgent, ...normal].slice(0, 4).map(e => {
          const match = (e.from || '').match(/^(.+?)\s*<([^>]+)>$/);
          return {
            from: match ? match[1].trim().replace(/^"|"$/g, '') : (e.from || 'Unknown'),
            subject: e.subject || '(no subject)',
            time: e.time || '',
            urgent: e.priority === 'urgent',
          };
        }));
      }
    } catch (_) {}
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSummary();
    setTimeout(() => setRefreshing(false), 400);
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--s0)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <GreetIcon size={20} color="var(--amber)" />
              <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
                {greeting}
              </h1>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 30 }}>{dateStr}</p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            onClick={handleRefresh}
            className="btn btn-secondary"
            disabled={refreshing}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </motion.button>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <motion.div variants={stagger} initial="initial" animate="animate">

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <StatCard
                icon={Mail}
                label="Urgent Emails"
                value={summary?.email?.urgent ?? 0}
                sub={`${summary?.email?.unread ?? 0} unread total`}
                color="var(--red)"
                bgColor="rgba(239,68,68,0.08)"
              />
              <StatCard
                icon={Calendar}
                label="Meetings Today"
                value={summary?.calendar?.meetings ?? 0}
                sub={summary?.calendar?.next_meeting ? `Next: ${summary.calendar.next_meeting.time}` : 'No meetings'}
                color="var(--blue)"
                bgColor="rgba(59,130,246,0.08)"
              />
              <StatCard
                icon={CheckSquare}
                label="High Priority"
                value={summary?.tasks?.high ?? 0}
                sub={`${summary?.tasks?.total ?? 0} tasks total`}
                color="var(--amber)"
                bgColor="rgba(245,158,11,0.08)"
              />
              <StatCard
                icon={TrendingUp}
                label="Productivity"
                value="92%"
                sub="↑ 8% from yesterday"
                color="var(--green)"
                bgColor="rgba(34,197,94,0.08)"
              />
            </div>

            {/* Main Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 20, marginBottom: 24 }}>

              {/* Next Meeting */}
              <motion.div variants={cardVariant} className="card card-elevated" style={{ padding: 20 }}>
                <SectionHeader icon={Calendar} title="Next Meeting" color="var(--blue)" />
                {summary?.calendar?.next_meeting ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{
                      background: 'rgba(59,130,246,0.08)',
                      border: '1px solid rgba(59,130,246,0.18)',
                      borderRadius: 10,
                      padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                          {summary.calendar.next_meeting.title}
                        </h3>
                        <span className="badge badge-blue">Today</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
                        <Clock size={13} />
                        <span style={{ fontSize: 13 }}>{summary.calendar.next_meeting.time}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm">Prepare agenda</button>
                      <button className="btn btn-ghost btn-sm">View all <ArrowUpRight size={11} /></button>
                    </div>
                  </div>
                ) : (
                  <EmptyState text="No upcoming meetings" />
                )}
              </motion.div>

              {/* Priority Tasks */}
              <motion.div variants={cardVariant} className="card card-elevated" style={{ padding: 20 }}>
                <SectionHeader icon={CheckSquare} title="Priority Tasks" color="var(--amber)" />
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { title: 'Review Q1 budget analysis',    priority: 'high',   done: false },
                    { title: 'Prepare sprint planning doc',  priority: 'high',   done: false },
                    { title: 'Reply to client proposal',     priority: 'medium', done: false },
                    { title: 'Update team roadmap',          priority: 'medium', done: true  },
                  ].map((task, i) => <TaskRow key={i} task={task} />)}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                >
                  View all tasks <ArrowUpRight size={12} />
                </button>
              </motion.div>

              {/* Quick Actions */}
              <motion.div variants={cardVariant} className="card card-elevated" style={{ padding: 20 }}>
                <SectionHeader icon={Zap} title="Quick Actions" color="var(--purple)" />
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Morning routine', cmd: 'morning_routine', icon: Sunrise,     color: 'var(--amber)' },
                    { label: 'Triage inbox',    cmd: 'triage_inbox',    icon: Inbox,       color: 'var(--blue)' },
                    { label: 'Daily summary',   cmd: 'daily_summary',   icon: Star,        color: 'var(--purple)' },
                    { label: 'Check deadlines', cmd: 'check_deadlines', icon: AlertCircle, color: 'var(--red)' },
                    { label: 'Evening wrap-up', cmd: 'evening_routine', icon: Moon,        color: 'var(--green)' },
                  ].map(({ label, cmd, icon: Ic, color }) => (
                    <QuickActionBtn key={cmd} label={label} icon={Ic} color={color} onClick={() => onCommand(cmd)} />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Urgent Emails */}
            <motion.div variants={cardVariant} className="card card-elevated" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <SectionHeader icon={Mail} title="Urgent Emails" color="var(--red)" />
                <button className="btn btn-ghost btn-sm" onClick={() => onCommand('triage_inbox')}>
                  <Inbox size={12} /> Triage all
                </button>
              </div>
              <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {urgentEmails.length > 0
                  ? urgentEmails.map((email, i) => <EmailRow key={i} email={email} />)
                  : <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px 0', color: 'var(--text-3)', fontSize: 13 }}>No emails loaded</div>
                }
              </div>
            </motion.div>

            {/* Agent Activity */}
            {summary?.recent_activity?.length > 0 && (
              <motion.div variants={cardVariant} className="card card-elevated" style={{ padding: 20 }}>
                <SectionHeader icon={Bot} title="Agent Activity" color="var(--accent)" />
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {summary.recent_activity.map((a, i) => <ActivityRow key={i} activity={a} />)}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────── */

function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </div>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{title}</h2>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bgColor }) {
  return (
    <motion.div
      variants={cardVariant}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="card"
      style={{ padding: '18px 20px', background: 'var(--s2)' }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>
    </motion.div>
  );
}

function TaskRow({ task }) {
  const colors = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--blue)' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 10px', borderRadius: 8,
      background: task.done ? 'transparent' : 'var(--s3)',
      opacity: task.done ? 0.4 : 1,
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 4, flexShrink: 0,
        background: task.done ? 'var(--green)' : 'var(--s5)',
        border: task.done ? 'none' : '1.5px solid var(--border-strong)',
      }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)', textDecoration: task.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.title}
      </span>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors[task.priority] ?? 'var(--s5)', flexShrink: 0 }} />
    </div>
  );
}

function QuickActionBtn({ label, icon: Icon, color, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 8, background: 'var(--s3)',
        border: '1px solid var(--border)', color: 'var(--text-1)',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--s4)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      <div style={{ width: 22, height: 22, borderRadius: 5, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={12} color={color} />
      </div>
      <span style={{ flex: 1 }}>{label}</span>
      <ArrowUpRight size={11} color="var(--text-3)" />
    </motion.button>
  );
}

function EmailRow({ email }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
        borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--border)',
        cursor: 'pointer', transition: 'border-color 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: `hsl(${email.from.charCodeAt(0) * 9 % 360}, 50%, 30%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#fff',
      }}>
        {email.from[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{email.from}</span>
          <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginLeft: 8 }}>{email.time}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email.subject}
        </p>
        {email.urgent && <span className="badge badge-red" style={{ marginTop: 4 }}>Urgent</span>}
      </div>
    </div>
  );
}

function ActivityRow({ activity }) {
  const icons = { email: Mail, calendar: Calendar, task: CheckSquare, system: Bot };
  const Icon = icons[activity.type] ?? Bot;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--s4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={12} color="var(--text-2)" />
      </div>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{activity.message}</span>
      <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
        {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>{text}</div>;
}

function DashboardSkeleton() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 96, borderRadius: 14 }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 20 }}>
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 240, borderRadius: 14 }} />)}
      </div>
    </div>
  );
}

export default Dashboard;
