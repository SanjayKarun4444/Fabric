import React, { useState, useEffect } from 'react';
import '../styles/Dashboard.css';

function Dashboard({ onCommand }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    const result = await window.electronAPI.sendCommand('get_summary');
    if (result.success) {
      setSummary(result.result);
      setActivity(result.result.recent_activity || []);
    }
    setLoading(false);
  };

  const runQuickAction = async (command, label) => {
    const result = await onCommand(command);
    if (result.success) {
      addActivity({ type: 'action', message: `${label} completed`, timestamp: new Date().toISOString() });
      loadSummary();
    }
  };

  const addActivity = (item) => {
    setActivity((prev) => [item, ...prev].slice(0, 5));
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button className="btn-refresh" onClick={loadSummary} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>📧 Email</h3>
          </div>
          <div className="card-content">
            <div className="stats-row">
              <div className="stat">
                <div className="stat-number">{summary?.email?.urgent ?? '-'}</div>
                <div className="stat-label">Urgent</div>
              </div>
              <div className="stat">
                <div className="stat-number">{summary?.email?.unread ?? '-'}</div>
                <div className="stat-label">Unread</div>
              </div>
            </div>
            <button className="btn-action" onClick={() => onCommand('triage_inbox')}>
              Triage Inbox
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>📅 Calendar</h3>
          </div>
          <div className="card-content">
            <div className="stats-row">
              <div className="stat">
                <div className="stat-number">{summary?.calendar?.meetings ?? '-'}</div>
                <div className="stat-label">Meetings</div>
              </div>
              <div className="stat">
                <div className="stat-number">{summary?.calendar?.next_meeting?.title ?? '—'}</div>
                <div className="stat-label">Next Meeting</div>
              </div>
            </div>
            <button className="btn-action" onClick={() => onCommand('morning_routine')}>
              Run Morning Routine
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>✅ Tasks</h3>
          </div>
          <div className="card-content">
            <div className="stats-row">
              <div className="stat">
                <div className="stat-number">{summary?.tasks?.high ?? '-'}</div>
                <div className="stat-label">High Priority</div>
              </div>
              <div className="stat">
                <div className="stat-number">{summary?.tasks?.total ?? '-'}</div>
                <div className="stat-label">Total</div>
              </div>
            </div>
            <button className="btn-action" onClick={() => onCommand('daily_summary')}>
              Daily Summary
            </button>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>⚙️ Quick Actions</h3>
          </div>
          <div className="card-content quick-actions">
            <button className="quick-action-btn" onClick={() => runQuickAction('check_new_emails', 'Check for New Emails')}>
              Check for New Emails
            </button>
            <button className="quick-action-btn" onClick={() => runQuickAction('morning_routine', 'Morning Routine')}>
              Morning Routine
            </button>
            <button className="quick-action-btn" onClick={() => runQuickAction('evening_routine', 'Evening Routine')}>
              Evening Routine
            </button>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          {activity.length === 0 ? (
            <div className="activity-item">
              <div className="message">No recent activity yet.</div>
            </div>
          ) : (
            activity.map((item, idx) => (
              <div key={idx} className="activity-item">
                <span className="icon">{item.type === 'email' ? '📧' : item.type === 'meeting' ? '📅' : '✅'}</span>
                <div className="message">{item.message}</div>
                <div className="timestamp">{new Date(item.timestamp).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
