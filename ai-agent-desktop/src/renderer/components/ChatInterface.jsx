import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Bot, User, Sparkles, Paperclip, RotateCcw,
  Copy, Plus, Trash2, MessageSquare, ChevronLeft, ChevronRight,
} from 'lucide-react';

const BACKEND = 'http://127.0.0.1:3001';

const SUGGESTED_PROMPTS = [
  { text: 'What tasks do I have today?' },
  { text: 'What urgent emails need my attention?' },
  { text: 'What meetings do I have today?' },
  { text: 'Summarize my day' },
  { text: 'Prepare me for tomorrow' },
  { text: 'Search for productivity tips' },
];

// ── Main component ─────────────────────────────────────────────────────────────

function ChatInterface({
  conversations,
  activeConvId,
  activeConv,
  onMessagesUpdate,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
}) {
  const [input, setInput]           = useState('');
  const [isTyping, setIsTyping]     = useState(false);
  const [copiedId, setCopiedId]     = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  const messages = activeConv?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || isTyping) return;

    const userMsg = { id: Date.now(), role: 'user', content: msg, timestamp: new Date().toISOString() };

    // Auto-title: first user message → conversation title (truncated)
    const isFirstUserMsg = messages.filter(m => m.role === 'user').length === 0;
    const newTitle = isFirstUserMsg ? msg.slice(0, 40) + (msg.length > 40 ? '…' : '') : undefined;

    const nextMessages = [...messages, userMsg];
    onMessagesUpdate(nextMessages, newTitle);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsTyping(true);

    try {
      const res = await fetch(`${BACKEND}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          conversation_id: activeConvId,
          user_id: 'default',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const content = data.response || 'Done!';
      const assistantMsg = { id: Date.now() + 1, role: 'assistant', content, timestamp: new Date().toISOString() };
      onMessagesUpdate([...nextMessages, assistantMsg]);
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, something went wrong: ${err.message}`,
        timestamp: new Date().toISOString(),
        error: true,
      };
      onMessagesUpdate([...nextMessages, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id, content) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleClear = () => {
    onMessagesUpdate([{
      id: Date.now(),
      role: 'assistant',
      content: 'Conversation cleared. How can I help you?',
      timestamp: new Date().toISOString(),
    }]);
  };

  const showSuggestions = messages.filter(m => m.role === 'user').length === 0;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* ── Conversation sidebar ─────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              flexShrink: 0, overflow: 'hidden',
              borderRight: '1px solid var(--border)',
              background: 'var(--s1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ width: 240, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Sidebar header */}
              <div style={{
                padding: '14px 12px 10px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Conversations
                </span>
                <button
                  onClick={onNewConversation}
                  className="btn btn-ghost btn-icon btn-sm"
                  title="New conversation"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Conversation list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
                {conversations.map(conv => (
                  <ConvItem
                    key={conv.id}
                    conv={conv}
                    isActive={conv.id === activeConvId}
                    onSelect={() => onSelectConversation(conv.id)}
                    onDelete={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--s1)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="btn btn-ghost btn-icon btn-sm"
              title={sidebarOpen ? 'Hide history' : 'Show history'}
            >
              {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)', flexShrink: 0,
            }}>
              <Sparkles size={14} color="#fff" />
            </div>

            <div>
              <h1 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
                {activeConv?.title || 'AI Assistant'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
                  boxShadow: '0 0 6px rgba(34,197,94,0.7)',
                  animation: 'pulseDot 2s ease-in-out infinite',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Online</span>
              </div>
            </div>
          </div>

          <button onClick={handleClear} className="btn btn-ghost btn-sm" title="Clear conversation">
            <RotateCcw size={12} />
            Clear
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>

            {/* Suggested prompts */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{ marginBottom: 28 }}
                >
                  <p style={{
                    fontSize: 12, color: 'var(--text-3)', textAlign: 'center',
                    marginBottom: 14, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    Suggestions
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {SUGGESTED_PROMPTS.map((p, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => handleSend(p.text)}
                        style={{
                          padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                          background: 'var(--s2)', border: '1px solid var(--border)',
                          color: 'var(--text-2)', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 13, lineHeight: 1.4,
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.color = 'var(--text-1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                      >
                        {p.text}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Message list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onCopy={() => handleCopy(msg.id, msg.content)}
                    copied={copiedId === msg.id}
                  />
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              <AnimatePresence>
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}
                  >
                    <BotAvatar />
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
                      background: 'var(--s2)', border: '1px solid var(--border)',
                    }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} className="typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--s1)', flexShrink: 0,
        }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex', alignItems: 'flex-end', gap: 8,
                background: 'var(--s3)', borderRadius: 14,
                border: '1px solid var(--border)',
                padding: '8px 8px 8px 14px',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-s)'; }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message your AI assistant... (Enter to send, Shift+Enter for new line)"
                disabled={isTyping}
                rows={1}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6,
                  resize: 'none', maxHeight: 120, overflowY: 'auto', padding: '4px 0',
                }}
                onInput={e => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: input.trim() && !isTyping ? 'var(--accent)' : 'var(--s5)',
                  border: 'none', cursor: input.trim() && !isTyping ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  boxShadow: input.trim() && !isTyping ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
                }}
              >
                <Send size={14} color="#fff" style={{ transform: 'translateX(1px)' }} />
              </motion.button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
              AI can make mistakes — verify important information
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Conversation list item ─────────────────────────────────────────────────────

function ConvItem({ conv, isActive, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const date = new Date(conv.createdAt);
  const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
        background: isActive ? 'var(--s3)' : hovered ? 'var(--s2)' : 'transparent',
        border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
        transition: 'all 0.1s', marginBottom: 2,
      }}
    >
      <MessageSquare size={13} color={isActive ? 'var(--accent)' : 'var(--text-3)'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: isActive ? 'var(--text-1)' : 'var(--text-2)',
          fontWeight: isActive ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {conv.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
      </div>
      {hovered && (
        <button
          onClick={onDelete}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', padding: 2, borderRadius: 4,
            display: 'flex', alignItems: 'center', flexShrink: 0,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
          title="Delete conversation"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

// ── Avatars ───────────────────────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
    }}>
      <Bot size={13} color="#fff" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
      background: 'var(--s5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <User size={13} color="var(--text-2)" />
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, onCopy, copied }) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Render markdown-style bold (**text**) and newlines
  const renderContent = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      return part.split('\n').map((line, j, arr) => (
        <React.Fragment key={`${i}-${j}`}>
          {line}{j < arr.length - 1 && <br />}
        </React.Fragment>
      ));
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}

      <div style={{ maxWidth: '74%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser
            ? 'linear-gradient(135deg, #6366f1, #5154e7)'
            : message.error ? 'rgba(239,68,68,0.1)' : 'var(--s2)',
          border: isUser ? 'none' : message.error ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
          color: isUser ? '#fff' : message.error ? '#f87171' : 'var(--text-1)',
          fontSize: 14, lineHeight: 1.65, wordBreak: 'break-word',
          boxShadow: isUser ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
        }}>
          {renderContent(message.content)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, opacity: 0.7 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{time}</span>
          {!isUser && (
            <button
              onClick={onCopy}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, padding: '1px 4px', borderRadius: 4, transition: 'color 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-2)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}
            >
              <Copy size={11} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default ChatInterface;
