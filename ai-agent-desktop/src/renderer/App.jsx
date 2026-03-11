import React, { useState, useEffect } from 'react';
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

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const agentStatus = useAgentStatus();

  useEffect(() => {
    const unsubNav = window.electronAPI?.onNavigate?.((page) => setCurrentView(page));
    const unsubUpdate = window.electronAPI?.onAgentUpdate?.((data) => handleAgentUpdate(data));
    loadInitialData();
    return () => {
      unsubNav?.();
      unsubUpdate?.();
    };
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

  const handleAgentUpdate = (data) => {
    if (data.type === 'new_emails' && data.data?.urgent > 0) {
      addNotification(`${data.data.urgent} urgent email${data.data.urgent > 1 ? 's' : ''} need attention`, 'warning');
    } else if (data.type === 'morning_routine') {
      addNotification('Morning routine complete — good morning!', 'success');
    } else if (data.type === 'evening_routine') {
      addNotification('Evening routine complete — great day!', 'success');
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

  const removeNotification = (id) =>
    setNotifications(prev => prev.filter(n => n.id !== id));

  if (isLoading) return <LoadingScreen />;

  const views = {
    dashboard: <Dashboard onCommand={handleCommand} />,
    email:     <EmailPanel onCommand={handleCommand} />,
    calendar:  <CalendarPanel onCommand={handleCommand} />,
    tasks:     <TaskPanel onCommand={handleCommand} />,
    chat:      <ChatInterface onCommand={handleCommand} />,
    agents:    <AgentMonitor agentStatus={agentStatus} onCommand={handleCommand} />,
    research:  <ResearchPanel onCommand={handleCommand} />,
    settings:  <SettingsPanel />,
  };

  return (
    <div className="app-shell">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        agentStatus={agentStatus}
      />

      <main className="main-area">
        <div className="notifications-stack">
          <AnimatePresence>
            {notifications.map(n => (
              <Notification key={n.id} {...n} onClose={() => removeNotification(n.id)} />
            ))}
          </AnimatePresence>
        </div>

        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ height: '100%' }}
            >
              {views[currentView] ?? views.dashboard}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default App;
