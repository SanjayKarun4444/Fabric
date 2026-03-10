# ALL REMAINING FRONTEND FILES

## React Components

### Dashboard.jsx
```jsx
import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

function Dashboard({ onCommand }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    const result = await window.electronAPI.sendCommand('get_summary');
    if (result.success) {
      setSummary(result.result);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="loading-container">
      <div className="spinner"></div>
      <p>Loading your dashboard...</p>
    </div>;
  }

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Good {getTimeOfDay()}!</h1>
        <button onClick={loadSummary} className="btn-refresh">
          🔄 Refresh
        </button>
      </header>

      <div className="dashboard-grid">
        {/* Email Summary Card */}
        <div className="dashboard-card email-card">
          <div className="card-header">
            <h3>📧 Email</h3>
          </div>
          <div className="card-content">
            <div className="stats-row">
              <div className="stat urgent">
                <span className="stat-number">{summary?.email?.urgent || 0}</span>
                <span className="stat-label">Urgent</span>
              </div>
              <div className="stat">
                <span className="stat-number">{summary?.email?.unread || 0}</span>
                <span className="stat-label">Unread</span>
              </div>
            </div>
            <button 
              onClick={() => onCommand('triage_inbox')}
              className="btn-action"
            >
              Triage Now
            </button>
          </div>
        </div>

        {/* Calendar Summary Card */}
        <div className="dashboard-card calendar-card">
          <div className="card-header">
            <h3>📅 Today's Schedule</h3>
          </div>
          <div className="card-content">
            <div className="stat">
              <span className="stat-number">{summary?.calendar?.meetings || 0}</span>
              <span className="stat-label">Meetings</span>
            </div>
            {summary?.calendar?.next_meeting && (
              <div className="next-meeting">
                <p className="meeting-title">{summary.calendar.next_meeting.title}</p>
                <p className="meeting-time">{summary.calendar.next_meeting.time}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tasks Summary Card */}
        <div className="dashboard-card tasks-card">
          <div className="card-header">
            <h3>✅ Tasks</h3>
          </div>
          <div className="card-content">
            <div className="stats-row">
              <div className="stat high-priority">
                <span className="stat-number">{summary?.tasks?.high || 0}</span>
                <span className="stat-label">High Priority</span>
              </div>
              <div className="stat">
                <span className="stat-number">{summary?.tasks?.total || 0}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>
            <button 
              onClick={() => onCommand('get_top_tasks')}
              className="btn-action"
            >
              View Tasks
            </button>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="dashboard-card actions-card">
          <div className="card-header">
            <h3>⚡ Quick Actions</h3>
          </div>
          <div className="card-content quick-actions">
            <button 
              onClick={() => onCommand('morning_routine')}
              className="quick-action-btn"
            >
              🌅 Morning Routine
            </button>
            <button 
              onClick={() => onCommand('daily_summary')}
              className="quick-action-btn"
            >
              📋 Daily Summary
            </button>
            <button 
              onClick={() => onCommand('check_deadlines')}
              className="quick-action-btn"
            >
              ⏰ Check Deadlines
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {summary?.recent_activity && (
        <div className="recent-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {summary.recent_activity.map((activity, i) => (
              <ActivityItem key={i} {...activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityItem({ type, message, timestamp }) {
  const icons = {
    email: '📧',
    calendar: '📅',
    task: '✅',
    system: '⚙️'
  };

  return (
    <div className="activity-item">
      <span className="icon">{icons[type] || '📝'}</span>
      <span className="message">{message}</span>
      <span className="timestamp">{new Date(timestamp).toLocaleTimeString()}</span>
    </div>
  );
}

export default Dashboard;
```

### EmailPanel.jsx
```jsx
import React, { useState, useEffect } from 'react';
import '../styles/EmailPanel.css';

function EmailPanel({ onCommand }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState(null);

  useEffect(() => {
    loadEmails();
  }, [filter]);

  const loadEmails = async () => {
    setLoading(true);
    const result = await window.electronAPI.sendCommand('get_emails', { filter });
    if (result.success) {
      setEmails(result.result.emails || []);
    }
    setLoading(false);
  };

  const handleTriage = async () => {
    await onCommand('triage_inbox');
    loadEmails();
  };

  const handleEmailClick = (email) => {
    setSelectedEmail(email);
  };

  const handleReply = async (emailId) => {
    const result = await onCommand('draft_reply', { emailId });
    if (result.success) {
      alert('Draft created: ' + result.result.draft);
    }
  };

  const renderEmailList = () => {
    if (loading) {
      return <div className="loading">Loading emails...</div>;
    }

    if (emails.length === 0) {
      return <div className="empty-state">No emails to display</div>;
    }

    return emails.map(email => (
      <div 
        key={email.id}
        className={`email-item ${email.priority} ${selectedEmail?.id === email.id ? 'selected' : ''}`}
        onClick={() => handleEmailClick(email)}
      >
        <div className="email-header">
          <span className="sender">{email.from}</span>
          <span className="time">{email.time}</span>
        </div>
        <div className="email-subject">{email.subject}</div>
        <div className="email-snippet">{email.snippet}</div>
        {email.priority === 'urgent' && (
          <span className="priority-badge">🔴 Urgent</span>
        )}
      </div>
    ));
  };

  return (
    <div className="email-panel">
      <header className="panel-header">
        <h2>📧 Email</h2>
        <div className="header-actions">
          <button onClick={handleTriage} className="btn-primary">
            Triage Inbox
          </button>
          <button onClick={loadEmails} className="btn-secondary">
            Refresh
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={filter === 'urgent' ? 'active' : ''}
          onClick={() => setFilter('urgent')}
        >
          Urgent
        </button>
        <button 
          className={filter === 'unread' ? 'active' : ''}
          onClick={() => setFilter('unread')}
        >
          Unread
        </button>
      </div>

      <div className="email-container">
        <div className="email-list">
          {renderEmailList()}
        </div>

        {selectedEmail && (
          <div className="email-detail">
            <div className="detail-header">
              <h3>{selectedEmail.subject}</h3>
              <button 
                onClick={() => handleReply(selectedEmail.id)}
                className="btn-reply"
              >
                Reply
              </button>
            </div>
            <div className="detail-meta">
              <p><strong>From:</strong> {selectedEmail.from}</p>
              <p><strong>Time:</strong> {selectedEmail.time}</p>
            </div>
            <div className="detail-body">
              {selectedEmail.body}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmailPanel;
```

### CalendarPanel.jsx
```jsx
import React, { useState, useEffect } from 'react';
import '../styles/CalendarPanel.css';

function CalendarPanel({ onCommand }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadEvents();
  }, [selectedDate]);

  const loadEvents = async () => {
    setLoading(true);
    const result = await window.electronAPI.sendCommand('get_calendar_events', {
      date: selectedDate.toISOString()
    });
    if (result.success) {
      setEvents(result.result.events || []);
    }
    setLoading(false);
  };

  const renderEvent = (event) => (
    <div key={event.id} className="event-item">
      <div className="event-time">{event.time}</div>
      <div className="event-details">
        <h4>{event.title}</h4>
        {event.location && <p className="event-location">📍 {event.location}</p>}
        {event.attendees && (
          <p className="event-attendees">
            👥 {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="calendar-panel">
      <header className="panel-header">
        <h2>📅 Calendar</h2>
        <button onClick={loadEvents} className="btn-secondary">
          Refresh
        </button>
      </header>

      <div className="calendar-container">
        <div className="calendar-sidebar">
          <div className="date-picker">
            <button onClick={() => setSelectedDate(new Date())}>
              Today
            </button>
          </div>
          <div className="quick-stats">
            <div className="stat">
              <span className="number">{events.length}</span>
              <span className="label">Events Today</span>
            </div>
          </div>
        </div>

        <div className="calendar-main">
          <h3>{selectedDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</h3>
          
          {loading ? (
            <div className="loading">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">No events scheduled</div>
          ) : (
            <div className="events-list">
              {events.map(renderEvent)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarPanel;
```

### TaskPanel.jsx
```jsx
import React, { useState, useEffect } from 'react';
import '../styles/TaskPanel.css';

function TaskPanel({ onCommand }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    const result = await window.electronAPI.sendCommand('get_tasks');
    if (result.success) {
      setTasks(result.result.tasks || []);
    }
    setLoading(false);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const result = await onCommand('add_task', { title: newTaskTitle });
    if (result.success) {
      setNewTaskTitle('');
      loadTasks();
    }
  };

  const handleToggleTask = async (taskId) => {
    await onCommand('toggle_task', { taskId });
    loadTasks();
  };

  const handleDeleteTask = async (taskId) => {
    await onCommand('delete_task', { taskId });
    loadTasks();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div className="task-panel">
      <header className="panel-header">
        <h2>✅ Tasks</h2>
        <button onClick={loadTasks} className="btn-secondary">
          Refresh
        </button>
      </header>

      <form onSubmit={handleAddTask} className="add-task-form">
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          className="task-input"
        />
        <button type="submit" className="btn-add">
          Add
        </button>
      </form>

      {loading ? (
        <div className="loading">Loading tasks...</div>
      ) : (
        <div className="tasks-list">
          {tasks.length === 0 ? (
            <div className="empty-state">No tasks yet. Add one above!</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id)}
                  className="task-checkbox"
                />
                <div className="task-content">
                  <h4>{task.title}</h4>
                  {task.due_date && (
                    <span className="task-due">Due: {task.due_date}</span>
                  )}
                </div>
                <span 
                  className="task-priority"
                  style={{ backgroundColor: getPriorityColor(task.priority) }}
                >
                  {task.priority}
                </span>
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="btn-delete"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TaskPanel;
```

### ChatInterface.jsx
```jsx
import React, { useState, useEffect, useRef } from 'react';
import '../styles/ChatInterface.css';

function ChatInterface({ onCommand }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessage = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Send to agent
    const result = await window.electronAPI.sendCommand('chat', {
      message: inputValue,
      history: messages
    });

    setIsTyping(false);

    if (result.success) {
      const assistantMessage = {
        role: 'assistant',
        content: result.result.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const errorMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${result.error}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="chat-interface">
      <header className="panel-header">
        <h2>💬 Chat with AI Agent</h2>
      </header>

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <p>{msg.content}</p>
              <span className="message-time">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          className="chat-input"
          disabled={isTyping}
        />
        <button type="submit" className="btn-send" disabled={isTyping || !inputValue.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatInterface;
```

### SettingsPanel.jsx
```jsx
import React, { useState, useEffect } from 'react';
import '../styles/SettingsPanel.css';

function SettingsPanel() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const result = await window.electronAPI.getSettings();
    if (result.success) {
      setSettings(result.settings);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await window.electronAPI.saveSettings(settings);
    if (result.success) {
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + result.error);
    }
    setSaving(false);
  };

  const handleChange = (section, key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="settings-panel">
      <header className="panel-header">
        <h2>⚙️ Settings</h2>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <div className="settings-content">
        {/* Notifications */}
        <section className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.notifications?.email || false}
                onChange={(e) => handleChange('notifications', 'email', e.target.checked)}
              />
              Email notifications
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.notifications?.calendar || false}
                onChange={(e) => handleChange('notifications', 'calendar', e.target.checked)}
              />
              Calendar notifications
            </label>
          </div>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.notifications?.tasks || false}
                onChange={(e) => handleChange('notifications', 'tasks', e.target.checked)}
              />
              Task notifications
            </label>
          </div>
        </section>

        {/* Schedules */}
        <section className="settings-section">
          <h3>Schedules</h3>
          <div className="setting-item">
            <label>
              Morning routine time:
              <input
                type="time"
                value={settings.schedules?.morningRoutine || '07:00'}
                onChange={(e) => handleChange('schedules', 'morningRoutine', e.target.value)}
              />
            </label>
          </div>
          <div className="setting-item">
            <label>
              Evening routine time:
              <input
                type="time"
                value={settings.schedules?.eveningRoutine || '18:00'}
                onChange={(e) => handleChange('schedules', 'eveningRoutine', e.target.value)}
              />
            </label>
          </div>
          <div className="setting-item">
            <label>
              Email check interval (minutes):
              <input
                type="number"
                value={settings.schedules?.emailCheck || 15}
                onChange={(e) => handleChange('schedules', 'emailCheck', parseInt(e.target.value))}
                min="5"
                max="60"
              />
            </label>
          </div>
        </section>

        {/* Theme */}
        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="setting-item">
            <label>
              Theme:
              <select
                value={settings.theme || 'dark'}
                onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </div>
        </section>

        {/* Auto Launch */}
        <section className="settings-section">
          <h3>Startup</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.autoLaunch || false}
                onChange={(e) => setSettings(prev => ({ ...prev, autoLaunch: e.target.checked }))}
              />
              Launch on system startup
            </label>
          </div>
        </section>

        {/* About */}
        <section className="settings-section">
          <h3>About</h3>
          <p>AI Agent Suite</p>
          <button onClick={() => window.electronAPI.checkForUpdates()}>
            Check for Updates
          </button>
        </section>
      </div>
    </div>
  );
}

export default SettingsPanel;
```

### Notification.jsx
```jsx
import React, { useEffect } from 'react';
import '../styles/Notification.css';

function Notification({ id, message, type, timestamp, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className={`notification ${type}`}>
      <span className="notification-icon">{getIcon()}</span>
      <div className="notification-content">
        <p className="notification-message">{message}</p>
        <span className="notification-time">
          {timestamp.toLocaleTimeString()}
        </span>
      </div>
      <button onClick={onClose} className="notification-close">
        ×
      </button>
    </div>
  );
}

export default Notification;
```

### LoadingScreen.jsx
```jsx
import React from 'react';
import '../styles/LoadingScreen.css';

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">🤖</div>
        <h2>AI Agent Suite</h2>
        <div className="loading-spinner"></div>
        <p>Initializing agents...</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
```

## React Hooks

### useAgentStatus.js
```jsx
import { useState, useEffect } from 'react';

export function useAgentStatus() {
  const [status, setStatus] = useState({
    connected: false,
    activeAgents: [],
    lastUpdate: null
  });

  useEffect(() => {
    checkStatus();
    
    // Check every 10 seconds
    const interval = setInterval(checkStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const result = await window.electronAPI.getAgentStatus();
      if (result.success) {
        setStatus({
          connected: true,
          activeAgents: result.status.active_agents || [],
          lastUpdate: new Date()
        });
      } else {
        setStatus(prev => ({ ...prev, connected: false }));
      }
    } catch (error) {
      setStatus(prev => ({ ...prev, connected: false }));
    }
  };

  return status;
}
```

---

Continue in next message with CSS files...
