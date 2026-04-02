import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EmailPanel from './components/EmailPanel';
import CalendarPanel from './components/CalendarPanel';
import TaskPanel from './components/TaskPanel';
import ChatInterface from './components/ChatInterface';
import AgentMonitor from './components/AgentMonitor';
import ResearchPanel from './components/ResearchPanel';
import SettingsPanel from './components/SettingsPanel';
import Notification from './components/Notification';
import LoadingScreen from './components/LoadingScreen';
import { useAgentStatus } from './hooks/useAgentStatus';
import './styles/index.css';
import './styles/App.css';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.15, ease: 'easeIn' } },
};

// ── Conversation helpers ───────────────────────────────────────────────────────

const WELCOME_TEXT =
  "Hello! I'm your personal AI assistant. I can help you manage email, calendar, tasks, and much more. What can I do for you today?";

function makeWelcomeMsg() {
  return { id: Date.now(), role: 'assistant', content: WELCOME_TEXT, timestamp: new Date().toISOString() };
}

function makeConversation(id = 'default') {
  return {
    id,
    title: 'New Chat',
    messages: [makeWelcomeMsg()],
    createdAt: new Date().toISOString(),
  };
}

function loadConversations() {
  try {
    const raw = localStorage.getItem('fabric_conversations');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [makeConversation()];
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const [currentView, setCurrentView]       = useState('dashboard');
  const [notifications, setNotifications]   = useState([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [conversations, setConversations]   = useState(loadConversations);
  const [activeConvId, setActiveConvId]     = useState(() => loadConversations()[0]?.id ?? 'default');
  const agentStatus = useAgentStatus();

  // Stable ref so event callbacks always see the current activeConvId
  // without needing to re-register listeners on every state change.
  const activeConvIdRef = useRef(activeConvId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  // Persist conversations to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem('fabric_conversations', JSON.stringify(conversations)); }
    catch {}
  }, [conversations]);

  useEffect(() => {
    const unsubNav    = window.electronAPI?.onNavigate?.((page) => setCurrentView(page));
    const unsubUpdate = window.electronAPI?.onAgentUpdate?.((data) => handleAgentUpdate(data));
    loadInitialData();
    return () => { unsubNav?.(); unsubUpdate?.(); };
  }, []);

  const loadInitialData = async () => {
    try {
      const status = await window.electronAPI?.getAgentStatus?.();
      if (status?.success) console.log('Agent connected:', status.status);
    } catch (err) {
      addNotification('Failed to connect to agent backend', 'error');
    } finally {
      setTimeout(() => setIsLoading(false), 800);
    }
  };

  // Intents whose results should be surfaced directly in chat.
  // key = intent name, value = { label shown in notification, field holding the text }
  const BRIEFING_INTENTS = {
    compile_morning_briefing: { label: 'Morning Briefing',  field: 'briefing' },
    compile_daily_summary:    { label: 'Daily Summary',     field: 'summary'  },
    compile_briefing:         { label: 'Meeting Prep Brief',field: 'briefing' },
  };

  const handleAgentUpdate = (data) => {
    // All backend events arrive as {type:"event", event_type:"...", payload:{...}}
    if (data.type === 'event') {
      const { event_type, payload } = data;

      // ── Briefing / summary results → inject into active chat ────────────
      if (event_type === 'task.result' && payload?.success && payload?.agent === 'assistant_agent') {
        const info = BRIEFING_INTENTS[payload.intent];
        const text = info && payload.result?.[info.field];
        if (text) {
          const msg = { id: Date.now(), role: 'assistant', content: text, timestamp: new Date().toISOString() };
          // Use functional updater + ref so we always append to the right conversation
          setConversations(prev => prev.map(c =>
            c.id === activeConvIdRef.current
              ? { ...c, messages: [...c.messages, msg] }
              : c
          ));
          setCurrentView('chat');
          addNotification(`${info.label} ready — check your chat`, 'success');
          return;
        }
      }

      // ── Inbox triage notifications ───────────────────────────────────────
      if (event_type === 'inbox.triaged') {
        const urgent = payload?.triaged?.filter(e => e?.urgency === 'urgent').length ?? 0;
        if (urgent > 0)
          addNotification(`${urgent} urgent email${urgent > 1 ? 's' : ''} need your attention`, 'warning');
      }
    }
  };

  const handleCommand = async (command, args) => {
    try {
      const result = await window.electronAPI?.sendCommand?.(command, args);
      if (result?.success) return result;
      addNotification(result?.error || 'Command failed', 'error');
      return result;
    } catch (err) {
      addNotification(err.message, 'error');
      return { success: false, error: err.message };
    }
  };

  const addNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [{ id, message, type, timestamp: new Date() }, ...prev].slice(0, 5));
    setTimeout(() => removeNotification(id), 5000);
  };
  const removeNotification = (id) => setNotifications(prev => prev.filter(n => n.id !== id));

  // ── Conversation management ─────────────────────────────────────────────────

  const getActiveConv = () => conversations.find(c => c.id === activeConvId) ?? conversations[0];

  const updateMessages = (newMessages, title) => {
    setConversations(prev => prev.map(c =>
      c.id === activeConvId
        ? { ...c, messages: newMessages, ...(title ? { title } : {}) }
        : c
    ));
  };

  const newConversation = () => {
    const conv = makeConversation(Date.now().toString());
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
  };

  const selectConversation = (id) => {
    setActiveConvId(id);
    setCurrentView('chat');
  };

  const deleteConversation = (id) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = makeConversation();
        setActiveConvId(fresh.id);
        return [fresh];
      }
      if (id === activeConvId) setActiveConvId(next[0].id);
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingScreen />;

  const activeConv = getActiveConv();

  // Chat is always mounted (hidden when not active) so state is never lost
  const nonChatViews = {
    dashboard: <Dashboard onCommand={handleCommand} />,
    email:     <EmailPanel onCommand={handleCommand} />,
    calendar:  <CalendarPanel onCommand={handleCommand} />,
    tasks:     <TaskPanel onCommand={handleCommand} />,
    agents:    <AgentMonitor agentStatus={agentStatus} onCommand={handleCommand} />,
    research:  <ResearchPanel onCommand={handleCommand} />,
    settings:  <SettingsPanel />,
  };

  return (
    <div className="app-shell">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} agentStatus={agentStatus} />

      <main className="main-area">
        <div className="notifications-stack">
          <AnimatePresence>
            {notifications.map(n => (
              <Notification key={n.id} {...n} onClose={() => removeNotification(n.id)} />
            ))}
          </AnimatePresence>
        </div>

        <div className="page-content">
          {/* Chat is always mounted, just hidden — preserves messages across tab switches */}
          <div style={{ height: '100%', display: currentView === 'chat' ? 'block' : 'none' }}>
            <ChatInterface
              conversations={conversations}
              activeConvId={activeConvId}
              activeConv={activeConv}
              onMessagesUpdate={updateMessages}
              onNewConversation={newConversation}
              onSelectConversation={selectConversation}
              onDeleteConversation={deleteConversation}
            />
          </div>

          {/* All other views with page transition */}
          {currentView !== 'chat' && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                style={{ height: '100%' }}
              >
                {nonChatViews[currentView] ?? nonChatViews.dashboard}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
