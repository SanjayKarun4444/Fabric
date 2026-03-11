import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Mic, Paperclip, RotateCcw, Copy, ThumbsUp } from 'lucide-react';

const SUGGESTED_PROMPTS = [
  { icon: '📋', text: 'Summarize my day' },
  { icon: '📧', text: 'What urgent emails need my attention?' },
  { icon: '✅', text: 'What are my top 3 priorities today?' },
  { icon: '📅', text: 'What meetings do I have today?' },
  { icon: '🔍', text: 'Research competitors in my space' },
  { icon: '💡', text: 'Give me ideas to improve productivity' },
];

function ChatInterface({ onCommand }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: "Hello! I'm your personal AI assistant. I can help you manage email, calendar, tasks, and much more. What can I do for you today?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || isTyping) return;

    const userMsg = { id: Date.now(), role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await window.electronAPI?.sendCommand?.('chat', {
        message: msg,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      });

      const content = result?.success
        ? result.result?.response ?? 'Done!'
        : `I ran into an issue: ${result?.error ?? 'Unknown error'}`;

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, something went wrong: ${err.message}`,
        timestamp: new Date(),
        error: true,
      }]);
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
    setMessages([{
      id: Date.now(),
      role: 'assistant',
      content: 'Conversation cleared. How can I help you?',
      timestamp: new Date(),
    }]);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--s0)' }}>

      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--s1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
          }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.2 }}>
              AI Assistant
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
          <RotateCcw size={13} />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>

          {/* Suggested prompts */}
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{ marginBottom: 32 }}
              >
                <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginBottom: 16, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Suggestions
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {SUGGESTED_PROMPTS.map((p, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleSend(p.text)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 10,
                        background: 'var(--s2)', border: '1px solid var(--border)',
                        color: 'var(--text-2)', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: 12, textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{p.icon}</span>
                      <span style={{ lineHeight: 1.3 }}>{p.text}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
        padding: '16px 24px',
        borderTop: '1px solid var(--border)',
        background: 'var(--s1)',
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: 'var(--s3)', borderRadius: 14,
            border: '1px solid var(--border)',
            padding: '8px 8px 8px 16px',
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
                resize: 'none', maxHeight: 120, overflowY: 'auto',
                padding: '4px 0',
              }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                style={{ opacity: 0.5 }}
                title="Attach file"
              >
                <Paperclip size={14} />
              </button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: input.trim() && !isTyping ? 'var(--accent)' : 'var(--s5)',
                  border: 'none', cursor: input.trim() && !isTyping ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, box-shadow 0.15s',
                  boxShadow: input.trim() && !isTyping ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
                  flexShrink: 0,
                }}
              >
                <Send size={14} color="#fff" style={{ transform: 'translateX(1px)' }} />
              </motion.button>
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>
            AI can make mistakes — verify important information
          </p>
        </div>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
    }}>
      <Bot size={14} color="#fff" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
      background: 'var(--s5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <User size={14} color="var(--text-2)" />
    </div>
  );
}

function MessageBubble({ message, onCopy, copied }) {
  const isUser = message.role === 'user';
  const time = message.timestamp instanceof Date
    ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div
          style={{
            padding: '11px 15px',
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            background: isUser
              ? 'linear-gradient(135deg, #6366f1, #5154e7)'
              : message.error ? 'rgba(239,68,68,0.1)' : 'var(--s2)',
            border: isUser
              ? 'none'
              : message.error ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)',
            color: isUser ? '#fff' : message.error ? '#f87171' : 'var(--text-1)',
            fontSize: 14,
            lineHeight: 1.65,
            wordBreak: 'break-word',
            boxShadow: isUser ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          {message.content}
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, opacity: 0.7 }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{time}</span>
          {!isUser && (
            <button
              onClick={onCopy}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, padding: '1px 4px', borderRadius: 4,
                transition: 'color 0.12s',
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
