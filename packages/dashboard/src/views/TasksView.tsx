import React, { useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { createTask, approveTask, rejectTask } from '../lib/api.ts';

const COLUMNS = ['queued', 'running', 'review', 'completed', 'failed'] as const;

export function TasksView() {
  const { tasks } = useWebSocket();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const tasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        <button className="btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
          + New Task
        </button>
      </div>

      {/* Create Task Form */}
      {showCreateForm && <CreateTaskForm onClose={() => setShowCreateForm(false)} />}

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4 min-h-[400px]">
        {COLUMNS.map(col => (
          <div key={col} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-gray-500 uppercase">{col}</h3>
              <span className="text-xs text-gray-600">{tasksByStatus(col).length}</span>
            </div>
            <div className="space-y-2">
              {tasksByStatus(col).map(task => (
                <div
                  key={task.id}
                  className="card cursor-pointer hover:border-accent/30 transition-colors"
                  onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{task.title}</p>
                    <PriorityDot priority={task.priority} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-600">{task.type}</span>
                    {task.assignedAgent && (
                      <span className="text-xs text-gray-500">@{task.assignedAgent}</span>
                    )}
                  </div>
                  {selectedTask === task.id && (
                    <TaskDetail task={task} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityDot({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    1: 'bg-danger',
    2: 'bg-warning',
    3: 'bg-info',
    4: 'bg-gray-400',
    5: 'bg-gray-600',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[priority] || 'bg-gray-500'}`} title={`Priority ${priority}`} />;
}

function TaskDetail({ task }: { task: any }) {
  return (
    <div className="mt-3 pt-3 border-t border-surface-3 space-y-2">
      {task.description && (
        <p className="text-xs text-gray-400">{task.description}</p>
      )}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
        {task.startedAt && <p>Started: {new Date(task.startedAt).toLocaleString()}</p>}
        {task.completedAt && <p>Completed: {new Date(task.completedAt).toLocaleString()}</p>}
      </div>
      {task.status === 'review' && (
        <div className="flex gap-2 pt-1">
          <button className="btn-primary text-xs px-3 py-1" onClick={(e) => { e.stopPropagation(); approveTask(task.id); }}>
            Approve
          </button>
          <button className="btn-danger text-xs px-3 py-1" onClick={(e) => { e.stopPropagation(); rejectTask(task.id); }}>
            Reject
          </button>
        </div>
      )}
      {task.output && (
        <details className="text-xs">
          <summary className="text-gray-500 cursor-pointer">Output</summary>
          <pre className="bg-surface-0 rounded p-2 mt-1 overflow-x-auto text-gray-400">
            {JSON.stringify(task.output, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function CreateTaskForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('manual');
  const [priority, setPriority] = useState(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({ title, description, type, priority });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Title</label>
        <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <textarea className="input w-full h-20 resize-none" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the task..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select className="input w-full" value={type} onChange={e => setType(e.target.value)}>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
            <option value="reactive">Reactive</option>
            <option value="chained">Chained</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Priority (1=urgent, 5=low)</label>
          <select className="input w-full" value={priority} onChange={e => setPriority(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Create Task</button>
      </div>
    </form>
  );
}
