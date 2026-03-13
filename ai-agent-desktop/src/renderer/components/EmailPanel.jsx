import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, RefreshCw, Inbox, Star, Reply, Archive,
  Search, AlertCircle, Clock, Trash2, Send,
  FileText, PenLine, CheckCircle2,
} from 'lucide-react';

const FILTERS = ['All', 'Urgent', 'Unread', 'Starred'];

function parseFrom(raw) {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  return { name: raw.trim(), email: raw.trim() };
}

function normalizeEmail(e) {
  const { name, email } = parseFrom(e.from || '');
  return {
    id: e.id,
    from: name || email,
    email: email,
    subject: e.subject || '(no subject)',
    snippet: e.snippet || '',
    time: e.time || '',
    priority: e.priority || 'normal',
    unread: true,
    starred: false,
    body: e.body || e.snippet || '',
  };
}

// ── EmailRow ──────────────────────────────────────────────────────────────────

function EmailRow({ email, isSelected, onClick, onStar }) {
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      style={{
        padding: '10px 10px', borderRadius: 10, cursor: 'pointer',
        background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
        marginBottom: 2, position: 'relative', transition: 'all 0.12s',
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

// ── DraftRow ──────────────────────────────────────────────────────────────────

function DraftRow({ draft, isSelected, onClick }) {
  const initials = (draft.to || '?')[0].toUpperCase();
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      style={{
        padding: '10px 10px', borderRadius: 10, cursor: 'pointer',
        background: isSelected ? 'rgba(99,102,241,0.1)' : 'transparent',
        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.25)' : 'transparent'}`,
        marginBottom: 2, transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--s3)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(99,102,241,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'var(--accent)',
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 1 }}>
            To: <span style={{ color: 'var(--text-2)' }}>{draft.to || '(no recipient)'}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
            {draft.subject || '(no subject)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {draft.snippet}
          </div>
        </div>
        <PenLine size={11} color="var(--text-3)" style={{ flexShrink: 0, marginTop: 2 }} />
      </div>
    </motion.div>
  );
}

// ── EmailDetail ───────────────────────────────────────────────────────────────

function EmailDetail({ email, onClose, onCommand }) {
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState('');

  const handleDraftReply = async () => {
    setDrafting(true);
    try {
      const result = await onCommand('draft_reply', { emailId: email.id });
      if (result?.success) setDraft(result.result?.draft ?? 'Hi,\n\nThank you for reaching out.\n\nBest regards');
      else setDraft('Hi,\n\nThank you for your email.\n\nBest regards');
    } catch (_) {
      setDraft('Draft could not be generated. Please try again.');
    }
    setDrafting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3, marginBottom: 14 }}>
          {email.subject}
        </h1>
        {email.priority === 'urgent' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12, fontWeight: 500, marginBottom: 16 }}>
            <AlertCircle size={12} /> Urgent — requires your attention
          </div>
        )}
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
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
          {email.body}
        </div>
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

// ── DraftEditor ───────────────────────────────────────────────────────────────

function DraftEditor({ draft, onSave, onSend, onDelete, onClose }) {
  const [to, setTo] = useState(draft.to || '');
  const [subject, setSubject] = useState(draft.subject || '');
  const [body, setBody] = useState(draft.body || '');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sentFlash, setSentFlash] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const ok = await onSave(draft.id, { to, subject, body });
    setSaving(false);
    if (ok) { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000); }
    else setError('Could not save draft — check backend logs.');
  };

  const handleSend = async () => {
    if (!to || !to.includes('@')) { setError('A valid email address is required in the To field.'); return; }
    setSending(true);
    setError(null);
    // Save any edits first, then send
    await onSave(draft.id, { to, subject, body });
    const ok = await onSend(draft.id);
    setSending(false);
    if (ok) { setSentFlash(true); setTimeout(() => { setSentFlash(false); onClose(); }, 1200); }
    else setError('Could not send — check that gmail.compose scope is authorised (run get_refresh_token.py).');
  };

  const fieldStyle = {
    width: '100%', background: 'var(--s2)', border: '1px solid var(--border)',
    borderRadius: 'var(--r)', color: 'var(--text-1)', fontSize: 13,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s1)', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>← Drafts</button>
        <div style={{ flex: 1 }} />
        {savedFlash && (
          <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={13} /> Saved
          </span>
        )}
        {sentFlash && (
          <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={13} /> Sent!
          </span>
        )}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleSave}
          disabled={saving || sending}
        >
          {saving ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <FileText size={12} />}
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSend}
          disabled={saving || sending}
        >
          {sending ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={12} />}
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button
          className="btn btn-ghost btn-sm btn-icon"
          onClick={() => onDelete(draft.id)}
          disabled={saving || sending}
        >
          <Trash2 size={14} color="var(--red)" />
        </button>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ margin: '10px 20px 0', padding: '8px 12px', borderRadius: 'var(--r)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <AlertCircle size={13} color="var(--red)" />
            <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compose fields */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 28px', gap: 14, overflow: 'hidden' }}>
        {/* To */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>To</label>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="recipient@example.com"
            style={{ ...fieldStyle, padding: '8px 12px' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-b)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Subject */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Subject</label>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            style={{ ...fieldStyle, padding: '8px 12px' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-b)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            style={{ ...fieldStyle, flex: 1, padding: '12px 14px', resize: 'none', lineHeight: 1.7 }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-b)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>
    </div>
  );
}

// ── EmailPanel (main) ─────────────────────────────────────────────────────────

export default function EmailPanel({ onCommand }) {
  const [mode, setMode] = useState('inbox'); // 'inbox' | 'drafts'

  // Inbox state
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [triaging, setTriaging] = useState(false);

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState(null); // full draft with body

  const filtered = emails.filter(e => {
    const matchSearch = !search || e.subject.toLowerCase().includes(search.toLowerCase()) || e.from.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'Urgent') return e.priority === 'urgent';
    if (filter === 'Unread') return e.unread;
    if (filter === 'Starred') return e.starred;
    return true;
  });

  const fetchEmails = async () => {
    setLoading(true); setFetchError(null);
    try {
      const result = await onCommand('get_emails', { max_results: 30 });
      if (result?.success && result.result?.emails) setEmails(result.result.emails.map(normalizeEmail));
      else setFetchError('Could not load emails.');
    } catch { setFetchError('Backend unreachable.'); }
    setLoading(false);
  };

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const result = await onCommand('list_drafts', { max_results: 20 });
      if (result?.success) setDrafts(result.result?.drafts || []);
    } catch {}
    setDraftsLoading(false);
  }, [onCommand]);

  useEffect(() => { fetchEmails(); }, []);
  useEffect(() => { if (mode === 'drafts') fetchDrafts(); }, [mode, fetchDrafts]);

  const openDraft = async (draftSummary) => {
    // Fetch full draft with body
    try {
      const result = await onCommand('get_draft', { draft_id: draftSummary.id });
      if (result?.success && result.result) {
        setSelectedDraft(result.result);
      }
    } catch {}
  };

  const saveDraft = async (draftId, fields) => {
    try {
      const result = await onCommand('update_draft', { draft_id: draftId, ...fields });
      if (result?.success) {
        // Update local list summary too
        setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, to: fields.to, subject: fields.subject } : d));
        return true;
      }
      return false;
    } catch { return false; }
  };

  const sendDraft = async (draftId) => {
    try {
      const result = await onCommand('send_draft', { draft_id: draftId });
      if (result?.success) {
        setDrafts(prev => prev.filter(d => d.id !== draftId));
        setSelectedDraft(null);
        return true;
      }
      return false;
    } catch { return false; }
  };

  const deleteDraft = async (draftId) => {
    try {
      await onCommand('delete_draft', { draft_id: draftId });
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      setSelectedDraft(null);
    } catch {}
  };

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
  const rightPanelOpen = (mode === 'inbox' && selected) || (mode === 'drafts' && selectedDraft);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* ── Left column ───────────────────────────────────────────────────── */}
      <div style={{
        width: rightPanelOpen ? 340 : '100%',
        minWidth: rightPanelOpen ? 280 : undefined,
        borderRight: rightPanelOpen ? '1px solid var(--border)' : 'none',
        display: 'flex', flexDirection: 'column',
        background: 'var(--s1)', transition: 'width 0.25s ease', flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', background: 'var(--s3)', borderRadius: 8, padding: 3, gap: 2 }}>
                {[
                  { key: 'inbox', icon: Inbox, label: 'Inbox' },
                  { key: 'drafts', icon: PenLine, label: 'Drafts' },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => { setMode(key); setSelected(null); setSelectedDraft(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 6, border: 'none',
                      background: mode === key ? 'var(--s2)' : 'transparent',
                      color: mode === key ? 'var(--text-1)' : 'var(--text-3)',
                      fontFamily: 'inherit', fontSize: 11, fontWeight: mode === key ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.12s',
                      boxShadow: mode === key ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    <Icon size={11} />
                    {label}
                    {key === 'inbox' && unreadCount > 0 && (
                      <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: 1.6 }}>{unreadCount}</span>
                    )}
                    {key === 'drafts' && drafts.length > 0 && (
                      <span style={{ background: 'var(--s5)', color: 'var(--text-2)', borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 5px', lineHeight: 1.6 }}>{drafts.length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {mode === 'inbox' && (
                <button className="btn btn-primary btn-sm" onClick={handleTriage} disabled={triaging}>
                  {triaging ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Inbox size={12} />}
                  {triaging ? 'Triaging…' : 'AI Triage'}
                </button>
              )}
              <button
                className="btn btn-secondary btn-sm btn-icon"
                onClick={mode === 'inbox' ? fetchEmails : fetchDrafts}
                disabled={loading || draftsLoading}
              >
                <RefreshCw size={12} style={(loading || draftsLoading) ? { animation: 'spin 0.8s linear infinite' } : {}} />
              </button>
            </div>
          </div>

          {/* Search — inbox only */}
          {mode === 'inbox' && (
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
          )}

          {/* Filter tabs — inbox only */}
          {mode === 'inbox' && (
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
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {mode === 'inbox' ? (
            loading ? (
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
              </div>
            ) : fetchError ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>{fetchError}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>No emails found</div>
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
            )
          ) : (
            // Drafts list
            draftsLoading ? (
              <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}
              </div>
            ) : drafts.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                No drafts — ask the AI assistant to draft an email for you
              </div>
            ) : (
              drafts.map(draft => (
                <DraftRow
                  key={draft.id}
                  draft={draft}
                  isSelected={selectedDraft?.id === draft.id}
                  onClick={() => openDraft(draft)}
                />
              ))
            )
          )}
        </div>

        {/* Footer stats */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          {mode === 'inbox' ? (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{filtered.length} messages</span>
              {urgentCount > 0 && (
                <span style={{ fontSize: 11, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={11} /> {urgentCount} urgent
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mode === 'inbox' && selected && (
          <motion.div
            key="email-detail"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--s0)' }}
          >
            <EmailDetail email={selected} onClose={() => setSelected(null)} onCommand={onCommand} />
          </motion.div>
        )}

        {mode === 'drafts' && selectedDraft && (
          <motion.div
            key="draft-editor"
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--s0)' }}
          >
            <DraftEditor
              draft={selectedDraft}
              onSave={saveDraft}
              onSend={sendDraft}
              onDelete={deleteDraft}
              onClose={() => setSelectedDraft(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
