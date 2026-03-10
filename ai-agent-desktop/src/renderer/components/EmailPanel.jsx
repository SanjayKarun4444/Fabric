import React, { useState, useEffect } from 'react';

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

  return (
    <div className="email-panel">
      <header className="panel-header">
        <h2>📧 Email</h2>
        <div className="header-actions">
          <button onClick={() => onCommand('triage_inbox')} className="btn-primary">Triage Inbox</button>
          <button onClick={loadEmails} className="btn-secondary">Refresh</button>
        </div>
      </header>

      <div className="filter-bar">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
        <button className={filter === 'urgent' ? 'active' : ''} onClick={() => setFilter('urgent')}>Urgent</button>
        <button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Unread</button>
      </div>

      <div className="email-container">
        <div className="email-list">
          {loading ? <div className="loading">Loading emails...</div> : 
           emails.length === 0 ? <div className="empty-state">No emails</div> :
           emails.map(email => (
            <div key={email.id} className={`email-item ${email.priority} ${selectedEmail?.id === email.id ? 'selected' : ''}`}
                 onClick={() => setSelectedEmail(email)}>
              <div className="email-header">
                <span className="sender">{email.from}</span>
                <span className="time">{email.time}</span>
              </div>
              <div className="email-subject">{email.subject}</div>
              <div className="email-snippet">{email.snippet}</div>
            </div>
          ))}
        </div>

        {selectedEmail && (
          <div className="email-detail">
            <div className="detail-header">
              <h3>{selectedEmail.subject}</h3>
              <button onClick={() => onCommand('draft_reply', { emailId: selectedEmail.id })} className="btn-reply">Reply</button>
            </div>
            <div className="detail-meta">
              <p><strong>From:</strong> {selectedEmail.from}</p>
              <p><strong>Time:</strong> {selectedEmail.time}</p>
            </div>
            <div className="detail-body">{selectedEmail.body}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmailPanel;
