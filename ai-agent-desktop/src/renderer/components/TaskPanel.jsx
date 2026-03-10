import React, { useState, useEffect } from 'react';

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
    await onCommand('add_task', { title: newTaskTitle });
    setNewTaskTitle('');
    loadTasks();
  };

  return (
    <div className="task-panel">
      <header className="panel-header">
        <h2>✅ Tasks</h2>
        <button onClick={loadTasks} className="btn-secondary">Refresh</button>
      </header>

      <form onSubmit={handleAddTask} className="add-task-form">
        <input type="text" placeholder="Add a new task..." value={newTaskTitle}
               onChange={(e) => setNewTaskTitle(e.target.value)} className="task-input" />
        <button type="submit" className="btn-add">Add</button>
      </form>

      {loading ? <div className="loading">Loading tasks...</div> :
       <div className="tasks-list">
         {tasks.length === 0 ? <div className="empty-state">No tasks yet</div> :
          tasks.map(task => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <input type="checkbox" checked={task.completed}
                     onChange={() => onCommand('toggle_task', { taskId: task.id })} />
              <div className="task-content">
                <h4>{task.title}</h4>
                {task.due_date && <span className="task-due">Due: {task.due_date}</span>}
              </div>
              <span className="task-priority" style={{ backgroundColor: task.priority === 'high' ? 'red' : 'blue' }}>
                {task.priority}
              </span>
              <button onClick={() => onCommand('delete_task', { taskId: task.id })} className="btn-delete">🗑️</button>
            </div>
          ))}
       </div>
      }
    </div>
  );
}

export default TaskPanel;
