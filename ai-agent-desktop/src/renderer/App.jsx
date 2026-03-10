import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import EmailPanel from './components/EmailPanel';
import CalendarPanel from './components/CalendarPanel';
import TaskPanel from './components/TaskPanel';
import ChatInterface from './components/ChatInterface';
import SettingsPanel from './components/SettingsPanel';
import Notification from './components/Notification';
import LoadingScreen from './components/LoadingScreen';
import { useAgentStatus } from './hooks/useAgentStatus';
import './styles/App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const agentStatus = useAgentStatus();

  useEffect(() => {
    // Listen for navigation events from main process
    const unsubNav = window.electronAPI.onNavigate((page) => {
      setCurrentView(page);
    });

    // Listen for agent updates
    const unsubUpdate = window.electronAPI.onAgentUpdate((data) => {
      handleAgentUpdate(data);
    });

    // Initial load
    loadInitialData();

    return () => {
      unsubNav();
      unsubUpdate();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      // Check agent status
      const status = await window.electronAPI.getAgentStatus();
      if (status.success) {
        console.log('Agent connected:', status.status);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      addNotification('Failed to connect to agent', 'error');
      setIsLoading(false);
    }
  };

  const handleAgentUpdate = (data) => {
    console.log('Agent update:', data);
    
    // Show notification based on update type
    if (data.type === 'new_emails' && data.data.urgent > 0) {
      addNotification(
        `${data.data.urgent} urgent email${data.data.urgent > 1 ? 's' : ''}`,
        'info'
      );
    } else if (data.type === 'morning_routine') {
      addNotification('Morning routine complete!', 'success');
    } else if (data.type === 'evening_routine') {
      addNotification('Evening routine complete!', 'success');
    }
  };

  const handleCommand = async (command, args) => {
    try {
      addNotification(`Executing: ${command}...`, 'info');
      
      const result = await window.electronAPI.sendCommand(command, args);
      
      if (result.success) {
        addNotification(`${command} completed successfully`, 'success');
        return result;
      } else {
        addNotification(`Error: ${result.error}`, 'error');
        return result;
      }
    } catch (error) {
      addNotification(`Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  };

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date(),
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, 5));
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="app">
      <Sidebar 
        currentView={currentView}
        onNavigate={setCurrentView}
        agentStatus={agentStatus}
      />

      <main className="main-content">
        {/* Notifications */}
        <div className="notifications-container">
          {notifications.map(notif => (
            <Notification
              key={notif.id}
              {...notif}
              onClose={() => removeNotification(notif.id)}
            />
          ))}
        </div>

        {/* Views */}
        {currentView === 'dashboard' && (
          <Dashboard onCommand={handleCommand} />
        )}
        {currentView === 'email' && (
          <EmailPanel onCommand={handleCommand} />
        )}
        {currentView === 'calendar' && (
          <CalendarPanel onCommand={handleCommand} />
        )}
        {currentView === 'tasks' && (
          <TaskPanel onCommand={handleCommand} />
        )}
        {currentView === 'chat' && (
          <ChatInterface onCommand={handleCommand} />
        )}
        {currentView === 'settings' && (
          <SettingsPanel />
        )}
      </main>
    </div>
  );
}

export default App;
