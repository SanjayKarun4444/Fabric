import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Plus, Trash2, Flag, Calendar, Search, SortAsc, MoreHorizontal } from 'lucide-react';

const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: 'var(--red)',    badge: 'badge-red',    dot: '#ef4444' },
  medium: { label: 'Medium', color: 'var(--amber)',  badge: 'badge-amber',  dot: '#f59e0b' },
  low:    { label: 'Low',    color: 'var(--blue)',   badge: 'badge-blue',   dot: '#3b82f6' },
};

const MOCK_TASKS = [
  { id: '1', title: 'Review Q1 budget analysis',         priority: 'high',   completed: false, due: '2026-03-12', tags: ['Finance'] },
  { id: '2', title: 'Prepare sprint planning document',  priority: 'high',   completed: false, due: '2026-03-11', tags: ['Engineering'] },
  { id: '3', title: 'Reply to client contract proposal', priority: 'high',   completed: false, due: '2026-03-10', tags: ['Sales'] },
  { id: '4', title: 'Update team roadmap for Q2',        priority: 'medium', completed: false, due: '2026-03-15', tags: ['Strategy'] },
  { id: '5', title: 'Research competitor pricing',       priority: 'medium', completed: false, due: '2026-03-14', tags: ['Research'] },
  { id: '6', title: 'Schedule 1:1s for next week',       priority: 'medium', completed: true,  due: '2026-03-09', tags: ['Management'] },
  { id: '7', title: 'Update LinkedIn profile',           priority: 'low',    completed: false, due: '2026-03-20', tags: [] },
  { id: '8', title: 'Read "Deep Work" chapter 4',        priority: 'low',    completed: true,  due: '2026-03-08', tags: ['Learning'] },
];

const VIEWS = ['All', 'Active', 'Completed'];

const STORAGE_KEY = 'fabric_tasks';

export default function TaskPanel({ onCommand }) {
  const [tasks, setTasks] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return MOCK_TASKS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (_) {}
  }, [tasks]);
  const [view, setView] = useState('Active');
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [adding, setAdding] = useState(false);
  const inputRef = React.useRef(null);

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (view === 'Active') return !t.completed;
    if (view === 'Completed') return t.completed;
    return true;
  });

  const grouped = {
    high:   filtered.filter(t => t.priority === 'high' && !t.completed),
    medium: filtered.filter(t => t.priority === 'medium' && !t.completed),
    low:    filtered.filter(t => t.priority === 'low' && !t.completed),
    done:   filtered.filter(t => t.completed),
  };

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

  const handleAdd = (e) => {
    e?.preventDefault();
    if (!newTitle.trim()) return;
    const task = { id: String(Date.now()), title: newTitle.trim(), priority: newPriority, completed: false, due: null, tags: [] };
    setTasks(prev => [task, ...prev]);
    setNewTitle('');
    setAdding(false);
    onCommand('add_task', { title: task.title, priority: task.priority });
  };

  const counts = {
    all: tasks.length,
    active: tasks.filter(t => !t.completed).length,
    done: tasks.filter(t => t.completed).length,
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--s0)' }}>

      {/* Left: Stats sidebar */}
      <div style={{ width: 220, borderRight: '1px solid var(--border)', background: 'var(--s1)', padding: '20px 14px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 20 }}>Tasks</h1>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Total',     value: counts.all,    color: 'var(--text-1)' },
            { label: 'Active',    value: counts.active, color: 'var(--amber)' },
            { label: 'Completed', value: counts.done,   color: 'var(--green)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'var(--s3)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Today's Progress</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>
              {counts.all > 0 ? Math.round((counts.done / counts.all) * 100) : 0}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--s4)', borderRadius: 99, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${counts.all > 0 ? (counts.done / counts.all) * 100 : 0}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: '100%', background: 'var(--green)', borderRadius: 99 }}
            />
          </div>
        </div>

        {/* Priority breakdown */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>BY PRIORITY</p>
          {['high', 'medium', 'low'].map(p => {
            const conf = PRIORITY_CONFIG[p];
            const count = tasks.filter(t => t.priority === p && !t.completed).length;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: conf.dot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>{conf.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: conf.color }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Task list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--s1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} color="var(--text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                className="input"
                placeholder="Search tasks…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 30, height: 32, fontSize: 12 }}
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="btn btn-primary btn-sm"
              onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            >
              <Plus size={13} /> Add task
            </motion.button>
          </div>

          {/* View tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--s3)', padding: 3, borderRadius: 8, width: 'fit-content' }}>
            {VIEWS.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  background: view === v ? 'var(--s2)' : 'transparent',
                  color: view === v ? 'var(--text-1)' : 'var(--text-3)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: view === v ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.12s',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Add task form */}
        <AnimatePresence>
          {adding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)' }}
            >
              <form onSubmit={handleAdd} style={{ padding: '12px 20px', background: 'rgba(99,102,241,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  ref={inputRef}
                  className="input"
                  placeholder="What needs to be done?"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  style={{ flex: 1, height: 36, fontSize: 14 }}
                  autoFocus
                />
                <select
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                  className="input"
                  style={{ width: 110, height: 36, fontSize: 13 }}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!newTitle.trim()}>Add</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {view === 'Active' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(['high', 'medium', 'low']).map(priority => {
                const group = grouped[priority];
                if (group.length === 0) return null;
                const conf = PRIORITY_CONFIG[priority];
                return (
                  <div key={priority}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Flag size={12} color={conf.color} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: conf.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {conf.label} Priority
                      </span>
                      <span className={`badge ${conf.badge}`} style={{ fontSize: 10 }}>{group.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <AnimatePresence>
                        {group.map((task, i) => (
                          <TaskItem key={task.id} task={task} delay={i * 0.04} onToggle={toggleTask} onDelete={deleteTask} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <AnimatePresence>
                {filtered.map((task, i) => (
                  <TaskItem key={task.id} task={task} delay={i * 0.03} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  {view === 'Completed' ? 'No completed tasks yet' : 'No tasks found'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task, delay, onToggle, onDelete }) {
  const conf = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.due && !task.completed && new Date(task.due) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
      transition={{ delay, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 10,
        background: task.completed ? 'transparent' : 'var(--s2)',
        border: `1px solid ${task.completed ? 'transparent' : 'var(--border)'}`,
        opacity: task.completed ? 0.45 : 1,
        transition: 'all 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.querySelector('.task-delete')?.style && (e.currentTarget.querySelector('.task-delete').style.opacity = '1')}
      onMouseLeave={e => e.currentTarget.querySelector('.task-delete')?.style && (e.currentTarget.querySelector('.task-delete').style.opacity = '0')}
    >
      {/* Checkbox */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onToggle(task.id)}
        style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          background: task.completed ? 'var(--green)' : 'transparent',
          border: task.completed ? 'none' : `1.5px solid ${conf.dot}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {task.completed && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{ fontSize: 10, color: '#fff', fontWeight: 800 }}
          >✓</motion.span>
        )}
      </motion.button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 14, color: 'var(--text-1)',
          textDecoration: task.completed ? 'line-through' : 'none',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
        }}>
          {task.title}
        </span>
        {(task.due || task.tags.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            {task.due && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text-3)' }}>
                <Calendar size={10} />
                {new Date(task.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {isOverdue && ' · Overdue'}
              </span>
            )}
            {task.tags.map(tag => (
              <span key={tag} className="badge badge-gray" style={{ fontSize: 9 }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Priority dot */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: conf.dot, flexShrink: 0 }} />

      {/* Delete */}
      <button
        className="task-delete"
        onClick={() => onDelete(task.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-3)', opacity: 0, transition: 'opacity 0.15s',
          display: 'flex', alignItems: 'center', padding: 2,
        }}
      >
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
}
