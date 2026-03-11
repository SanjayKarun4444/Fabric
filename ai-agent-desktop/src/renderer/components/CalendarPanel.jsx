import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, RefreshCw, ChevronLeft, ChevronRight, Clock, MapPin, Users, Plus, Video } from 'lucide-react';

const MOCK_EVENTS = [
  { id: '1', title: 'Team Standup',        time: '09:00', duration: '30m',  type: 'meeting',  color: '#6366f1', location: 'Google Meet',   attendees: ['alice@co.com', 'bob@co.com', 'carol@co.com'], virtual: true },
  { id: '2', title: 'Product Review',      time: '11:00', duration: '60m',  type: 'review',   color: '#3b82f6', location: 'Conf Room A',   attendees: ['david@co.com', 'eve@co.com'], virtual: false },
  { id: '3', title: 'Lunch with Sarah',    time: '12:30', duration: '90m',  type: 'personal', color: '#22c55e', location: 'The Bridge Café', attendees: ['sarah@co.com'], virtual: false },
  { id: '4', title: 'Q1 Planning',         time: '14:00', duration: '120m', type: 'planning', color: '#f59e0b', location: 'Zoom',           attendees: ['cto@co.com', 'vp@co.com', 'alice@co.com', 'bob@co.com', 'carol@co.com'], virtual: true },
  { id: '5', title: 'Engineering Sync',    time: '16:00', duration: '45m',  type: 'meeting',  color: '#a855f7', location: 'Slack Huddle',   attendees: ['eng1@co.com', 'eng2@co.com'], virtual: true },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarPanel({ onCommand }) {
  const [events, setEvents] = useState(MOCK_EVENTS);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [today] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  const getDaysInMonth = (d) => {
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return { first, count };
  };
  const { first, count } = getDaysInMonth(viewDate);

  const totalHours = events.reduce((acc, e) => acc + parseInt(e.duration), 0) / 60;

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
          <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
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
          <button className="btn btn-secondary btn-sm" onClick={() => setLoading(l => !l)}>
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
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          {event.virtual ? <><Video size={13} /> Join Meeting</> : '✓ Mark Attending'}
        </button>
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          Prepare agenda
        </button>
      </div>
    </div>
  );
}
