import React, { useState, useEffect } from 'react';

function CalendarPanel({ onCommand }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadEvents();
  }, [selectedDate]);

  const loadEvents = async () => {
    setLoading(true);
    const result = await window.electronAPI.sendCommand('get_calendar_events', { date: selectedDate.toISOString() });
    if (result.success) {
      setEmails(result.result.events || []);
    }
    setLoading(false);
  };

  return (
    <div className="calendar-panel">
      <header className="panel-header">
        <h2>📅 Calendar</h2>
        <button onClick={loadEvents} className="btn-secondary">Refresh</button>
      </header>

      <div className="calendar-container">
        <div className="calendar-sidebar">
          <button onClick={() => setSelectedDate(new Date())}>Today</button>
          <div className="quick-stats">
            <div className="stat">
              <span className="number">{events.length}</span>
              <span className="label">Events Today</span>
            </div>
          </div>
        </div>

        <div className="calendar-main">
          <h3>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
          
          {loading ? <div className="loading">Loading events...</div> :
           events.length === 0 ? <div className="empty-state">No events scheduled</div> :
           <div className="events-list">
             {events.map(event => (
               <div key={event.id} className="event-item">
                 <div className="event-time">{event.time}</div>
                 <div className="event-details">
                   <h4>{event.title}</h4>
                   {event.location && <p className="event-location">📍 {event.location}</p>}
                 </div>
               </div>
             ))}
           </div>
          }
        </div>
      </div>
    </div>
  );
}

export default CalendarPanel;
