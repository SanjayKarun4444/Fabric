import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, RefreshCw, ChevronLeft, ChevronRight, Clock, MapPin, Users, Plus, Video, X } from 'lucide-react';


const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarPanel({ onCommand }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [showNewEvent, setShowNewEvent] = useState(false);

  const fetchEvents = async (date) => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = (date || today).toISOString().split('T')[0];
      const res = await window.electronAPI.sendCommand('get_calendar_events', { date: dateStr });
      if (res?.result?.events) {
        setEvents(res.result.events);
      }
    } catch (e) {
      setError('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(today); }, []);

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  const getDaysInMonth = (d) => {
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { first, count };
  };
  const { first, count } = getDaysInMonth(viewDate);

  const totalHours = events.reduce((acc, e) => acc + (parseInt(e.duration) || 0), 0) / 60;

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* Left: Mini calendar + day overview */}
      <div style={{ width: 280, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--s1)', flexShrink: 0 }}>

        {/* Mini calendar header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
              <button className="btn btn-ghost btn-sm" onClick={goToday} style={{ fontSize: 11 }}>Today</button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
            </div>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', padding: '2px 0', letterSpacing: '0.05em' }}>
                {d[0]}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {[...Array(first)].map((_, i) => <div key={`e-${i}`} />)}
            {[...Array(count)].map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate() && viewDate.getMonth() === today.getMonth() && viewDate.getFullYear() === today.getFullYear();
              const hasEvent = day % 3 === 0 || day % 5 === 0;
              return (
                <div
                  key={day}
                  style={{
                    textAlign: 'center', padding: '5px 0', borderRadius: 7, fontSize: 12,
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--text-2)',
                    fontWeight: isToday ? 700 : 400,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = 'var(--s4)'; }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = 'transparent'; }}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: 'var(--accent)' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Day stats */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>TODAY</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Meetings', value: events.length, color: 'var(--accent)' },
              { label: 'Hours', value: `${totalHours.toFixed(1)}h`, color: 'var(--blue)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding: '14px 16px' }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setShowNewEvent(true)}
          >
            <Plus size={13} /> New Event
          </button>
        </div>
      </div>

      {/* Right: Timeline / event list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--s1)', flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{events.length} events scheduled</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchEvents(today)} disabled={loading}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Events timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
              <Calendar size={32} color="var(--s5)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--red, #ef4444)' }}>{error}</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => fetchEvents(today)}>Try again</button>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
              <Calendar size={32} color="var(--s5)" style={{ margin: '0 auto 12px' }} />
              <p>No events today. Enjoy the free time!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isSelected={selectedEvent?.id === event.id}
                  delay={i * 0.05}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event detail panel */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 300 }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ borderLeft: '1px solid var(--border)', background: 'var(--s1)', overflow: 'hidden', flexShrink: 0 }}
          >
            <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Event modal */}
      <AnimatePresence>
        {showNewEvent && (
          <NewEventModal
            today={today}
            onClose={() => setShowNewEvent(false)}
            onCreated={() => { setShowNewEvent(false); fetchEvents(today); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EventCard({ event, isSelected, delay, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      style={{
        display: 'flex', gap: 16, padding: '14px 18px', borderRadius: 12,
        background: isSelected ? `${event.color}12` : 'var(--s2)',
        border: `1px solid ${isSelected ? `${event.color}40` : 'var(--border)'}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {/* Time indicator */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{event.time}</span>
        <div style={{ width: 2, flex: 1, background: 'var(--border)', borderRadius: 1, margin: '6px 0 4px', minHeight: 16 }} />
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{event.duration}</span>
      </div>

      {/* Colored accent */}
      <div style={{ width: 3, borderRadius: 99, background: event.color, flexShrink: 0, alignSelf: 'stretch' }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{event.title}</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {event.virtual && <span className="badge badge-blue"><Video size={9} /> Virtual</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {event.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
              <MapPin size={11} /> {event.location}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 12 }}>
            <Users size={11} /> {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EventDetail({ event, onClose }) {
  return (
    <div style={{ padding: '20px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Event Details</h2>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
      </div>

      {/* Color accent + title */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 12, height: 12, borderRadius: 4, background: event.color, flexShrink: 0, marginTop: 4 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3 }}>{event.title}</h3>
      </div>

      {/* Time */}
      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Clock size={13} color="var(--text-3)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{event.time}</span>
          <span className="badge badge-gray">{event.duration}</span>
        </div>
        {event.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {event.virtual ? <Video size={13} color="var(--blue)" /> : <MapPin size={13} color="var(--text-3)" />}
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{event.location}</span>
          </div>
        )}
      </div>

      {/* Attendees */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>ATTENDEES ({event.attendees.length})</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {event.attendees.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `hsl(${a.charCodeAt(0) * 9 % 360}, 45%, 28%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {a[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {event.virtual && event.joinUrl ? (
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => window.electronAPI.openExternal(event.joinUrl)}>
            <Video size={13} /> Join Meeting
          </button>
        ) : event.htmlLink ? (
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => window.electronAPI.openExternal(event.htmlLink)}>
            Open in Google Calendar
          </button>
        ) : null}
        {event.description && (
          <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {event.description.slice(0, 300)}{event.description.length > 300 ? '…' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

function NewEventModal({ today, onClose, onCreated }) {
  const defaultDate = today.toISOString().split('T')[0];
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await window.electronAPI?.sendCommand?.('create_calendar_event', {
        title: title.trim(),
        date,
        start_time: startTime,
        end_time: endTime,
        description: description.trim(),
      });
      if (result?.success) {
        onCreated();
      } else {
        setError(result?.error || 'Failed to create event');
      }
    } catch (_) {
      setError('Backend unreachable');
    }
    setSaving(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 420, background: 'var(--s2)', borderRadius: 16,
          border: '1px solid var(--border-strong)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={14} color="var(--accent)" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>New Event</span>
          </div>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Title *</label>
            <input
              ref={titleRef}
              className="input"
              placeholder="Event title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: '100%', height: 38 }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', height: 38 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Start</label>
              <input
                type="time"
                className="input"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{ width: '100%', height: 38 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>End</label>
              <input
                type="time"
                className="input"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                style={{ width: '100%', height: 38 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea
              className="input"
              placeholder="Optional description…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', paddingTop: 8, paddingBottom: 8 }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={saving || !title.trim()}>
              {saving ? <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={13} />}
              {saving ? 'Creating…' : 'Create Event'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
