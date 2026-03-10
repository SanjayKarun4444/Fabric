import React, { useEffect } from 'react';

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
        <span className="notification-time">{timestamp.toLocaleTimeString()}</span>
      </div>
      <button onClick={onClose} className="notification-close">×</button>
    </div>
  );
}

export default Notification;
