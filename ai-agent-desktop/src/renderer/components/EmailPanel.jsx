import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, RefreshCw, Inbox, Star, Reply, Archive,
  Search, AlertCircle, Clock, Trash2,
} from 'lucide-react';

const FILTERS = ['All', 'Urgent', 'Unread', 'Starred'];

const MOCK_EMAILS = [
  { id: '1', from: 'Sarah Chen', email: 'sarah.chen@company.com', subject: 'Q1 Budget Review — Action Required', snippet: 'Please review the attached Q1 budget analysis and provide your feedback by end of day...', time: '12m ago', priority: 'urgent', unread: true, starred: false, body: 'Hi,\n\nPlease review the attached Q1 budget analysis and provide your feedback by end of day. This is critical for the board meeting tomorrow.\n\nKey areas:\n• Revenue projections for Q2\n• Cost reduction initiatives\n• Headcount planning\n\nBest,\nSarah' },
  { id: '2', from: 'David Park', email: 'david@acmecorp.com', subject: 'Contract deadline — response needed', snippet: 'Following up on the contract I sent last week. We need a response by tomorrow EOD...', time: '1h ago', priority: 'urgent', unread: true, starred: true, body: 'Hi,\n\nFollowing up on the contract from last week. We need your response by tomorrow EOD to proceed.\n\nBest,\nDavid' },
  { id: '3', from: 'Marketing Team', email: 'marketing@company.com', subject: 'Campaign approval needed by EOD', snippet: 'The Q1 marketing campaign is ready for your approval. Creative assets attached...', time: '2h ago', priority: 'normal', unread: true, starred: false, body: 'Hi,\n\nThe Q1 campaign is ready for your approval. Please sign off by Friday.\n\nThanks!' },
  { id: '4', from: 'Alex Rivera', email: 'alex.r@company.com', subject: 'Sprint review notes & action items', snippet: "Here are the notes from today's sprint review. We shipped 14 of 16 planned stories...", time: '3h ago', priority: 'normal', unread: false, starred: false, body: "Team,\n\nSprint notes:\n- 14 of 16 stories shipped\n- Velocity up 12%\n- 2 items moved to next sprint\n\nSee you at planning!" },
  { id: '5', from: 'Board Office', email: 'board@company.com', subject: 'Board meeting prep materials', snippet: "Please find attached the agenda and materials for next week's board meeting...", time: '5h ago', priority: 'normal', unread: false, starred: true, body: 'Please find attached the agenda and materials for next week\'s board meeting. All executives should review before the meeting.' },
];

export default function EmailPanel({ onCommand }) {
  const [emails, setEmails] = useState(MOCK_EMAILS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [triaging, setTriaging] = useState(false);

  const filtered = emails.filter(e => {
    const matchSearch = !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'Urgent') return e.priority === 'urgent';
    if (filter === 'Unread') return e.unread;
    if (filter === 'Starred') return e.starred;
    return true;
  });

  const handleTriage = async () => {
    setTriaging(true);
    await onCommand('triage_inbox');
    setTriaging(false);
  };

  const toggleStar = (id, e) => {
    e.stopPropagation();
    setEmails(prev => prev.map(em => em.id === id ? { ...em, starred: !em.starred } : em));
  };

  const markRead = (id) => setEmails(prev => prev.map(em => em.id === id ? { ...em, unread: false } : em));

  const urgentCount = emails.filter(e => e.priority === 'urgent' && e.unread).length;
  const unreadCount = emails.filter(e => e.unread).length;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* Email list column */}
      <div style={{
        width: selected ? 340 : '100%',
        minWidth: selected ? 280 : undefined,
        borderRight: selected ? '1px solid var(--border)' : 'none',
        display: 'flex', flexDirection: 'column',
        background: 'var(--s1)',
        transition: 'width 0.25s ease',
        flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>Inbox</h1>
              {unreadCount > 0 && <span className="badge badge-accent">{unreadCount}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={handleTriage} disabled={triaging}>
                {triaging
                  ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <Inbox size={12} />}
                {triaging ? 'Triaging…' : 'AI Triage'}
              </button>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setLoading(l => !l)}>
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={13} color="var(--text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              className="input"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--s3)', padding: 3, borderRadius: 8 }}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 6, border: 'none',
                  background: filter === f ? 'var(--s2)' : 'transparent',
                  color: filter === f ? 'var(--text-1)' : 'var(--text-3)',
                  fontFamily: 'inherit', fontSize: 11, fontWeight: filter === f ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.12s',
                  boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {loading ? (
            <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              No emails found
            </div>
          ) : (
            filtered.map(email => (
              <EmailRow
                key={email.id}
                email={email}
                isSelected={selected?.id === email.id}
                onClick={() => { setSelected(email); markRead(email.id); }}
                onStar={(e) => toggleStar(email.id, e)}
              />
            ))
          )}
        </div>

        {/* Footer stats */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{filtered.length} messages</span>
          {urgentCount > 0 && (
            <span style={{ fontSize: 11, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={11} /> {urgentCount} urgent
            </span>
          )}
        </div>
      </div>

      {/* Detail pane */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--s0)' }}
          >
            <EmailDetail email={selected} onClose={() => setSelected(null)} onCommand={onCommand} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailRow({ email, isSelected, onClick, onStar }) {
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      style={{
        padding: '10px 10px',
        borderRadius: 10,
        cursor: 'pointer',
        background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
        marginBottom: 2,
        position: 'relative',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--s3)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {email.unread && (
        <span style={{
          position: 'absolute', left: 3, top: '50%', transform: 'translateY(-50%)',
          width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, paddingLeft: 6 }}>
        {/* Avatar */}
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: `hsl(${email.from.charCodeAt(0) * 9 % 360}, 45%, 28%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff',
        }}>
          {email.from[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: email.unread ? 700 : 400, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
              {email.from}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0, marginLeft: 6 }}>{email.time}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: email.unread ? 600 : 400, color: email.unread ? 'var(--text-1)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
            {email.subject}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email.snippet}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            {email.priority === 'urgent' && <span className="badge badge-red" style={{ fontSize: 9 }}>Urgent</span>}
            <button onClick={onStar} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginLeft: 'auto' }}>
              <Star size={11} color={email.starred ? 'var(--amber)' : 'var(--s5)'} fill={email.starred ? 'var(--amber)' : 'none'} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EmailDetail({ email, onClose, onCommand }) {
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState('');

  const handleDraftReply = async () => {
    setDrafting(true);
    try {
      const result = await onCommand('draft_reply', { emailId: email.id });
      if (result?.success) setDraft(result.result?.draft ?? 'Hi,\n\nThank you for reaching out. I\'ll review this and get back to you shortly.\n\nBest regards');
      else setDraft('Hi,\n\nThank you for your email. I\'ll review the attached materials and respond by end of day.\n\nBest regards');
    } catch (_) {
      setDraft('Draft could not be generated. Please try again.');
    }
    setDrafting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s1)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>← Back</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm"><Archive size={12} /> Archive</button>
        <button className="btn btn-secondary btn-sm"><Reply size={12} /> Reply</button>
        <button className="btn btn-primary btn-sm" onClick={handleDraftReply} disabled={drafting}>
          {drafting ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : '✨'}
          {drafting ? 'Drafting…' : 'AI Reply'}
        </button>
        <button className="btn btn-ghost btn-sm btn-icon"><Trash2 size={14} color="var(--red)" /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {/* Subject & priority */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3, marginBottom: 14 }}>
          {email.subject}
        </h1>
        {email.priority === 'urgent' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12, fontWeight: 500, marginBottom: 16 }}>
            <AlertCircle size={12} /> Urgent — requires your attention
          </div>
        )}

        {/* Sender info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '12px 16px', borderRadius: 12, background: 'var(--s2)', border: '1px solid var(--border)' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: `hsl(${email.from.charCodeAt(0) * 9 % 360}, 45%, 28%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {email.from[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{email.from}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{email.email}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 12 }}>
            <Clock size={12} /> {email.time}
          </div>
        </div>

        {/* Body */}
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
          {email.body}
        </div>

        {/* AI draft */}
        <AnimatePresence>
          {draft && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 28 }}>
              <div style={{ borderRadius: 12, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#818cf8' }}>✨ AI Draft Reply</span>
                </div>
                <div style={{ padding: 16, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{draft}</div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(99,102,241,0.2)', display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm">Use this reply</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDraft('')}>Dismiss</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
