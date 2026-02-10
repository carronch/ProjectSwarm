import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import type { Task, TaskCreateInput, TaskStatus, TaskLogEntry } from '@agent-dashboard/shared';

// ─── Task CRUD ──────────────────────────────────────────

export function createTask(input: TaskCreateInput): Task {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  const task: Task = {
    id,
    title: input.title,
    description: input.description,
    type: input.type,
    status: 'created',
    priority: input.priority ?? 3,
    assignedAgent: input.assignedAgent ?? null,
    parentTaskId: input.parentTaskId ?? null,
    input: input.input ?? {},
    output: null,
    requiresApproval: input.requiresApproval ?? true,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  };

  db.prepare(`
    INSERT INTO tasks (id, title, description, type, status, priority, assigned_agent,
      parent_task_id, input_json, output_json, requires_approval, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.title, task.description, task.type, task.status, task.priority,
    task.assignedAgent, task.parentTaskId, JSON.stringify(task.input), null,
    task.requiresApproval ? 1 : 0, task.createdAt
  );

  return task;
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
  return row ? mapTaskRow(row) : null;
}

export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  extra?: { output?: Record<string, unknown>; assignedAgent?: string }
): Task | null {
  const db = getDb();
  const task = getTask(id);
  if (!task) return null;

  const now = new Date().toISOString();
  let startedAt = task.startedAt;
  let completedAt = task.completedAt;
  const assignedAgent = extra?.assignedAgent ?? task.assignedAgent;
  const output = extra?.output ?? task.output;

  if (status === 'running' && !startedAt) startedAt = now;
  if (status === 'completed' || status === 'failed') completedAt = now;

  db.prepare(`
    UPDATE tasks
    SET status = ?, assigned_agent = ?, output_json = ?, started_at = ?, completed_at = ?
    WHERE id = ?
  `).run(status, assignedAgent, output ? JSON.stringify(output) : null, startedAt, completedAt, id);

  return { ...task, status, assignedAgent, output, startedAt, completedAt };
}

export function listTasks(options: {
  status?: TaskStatus;
  assignedAgent?: string;
  limit?: number;
} = {}): Task[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options.assignedAgent) {
    conditions.push('assigned_agent = ?');
    params.push(options.assignedAgent);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 100;

  return (db.prepare(`
    SELECT * FROM tasks ${where}
    ORDER BY priority ASC, created_at ASC LIMIT ?
  `).all(...params, limit) as any[]).map(mapTaskRow);
}

export function getNextQueuedTask(agentId?: string): Task | null {
  const db = getDb();
  let row: any;

  if (agentId) {
    row = db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'queued' AND (assigned_agent IS NULL OR assigned_agent = ?)
      ORDER BY priority ASC, created_at ASC LIMIT 1
    `).get(agentId);
  } else {
    row = db.prepare(`
      SELECT * FROM tasks
      WHERE status = 'queued'
      ORDER BY priority ASC, created_at ASC LIMIT 1
    `).get();
  }

  return row ? mapTaskRow(row) : null;
}

// ─── Task Logs ──────────────────────────────────────────

export function addTaskLog(
  taskId: string,
  agentId: string,
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: Record<string, unknown>
): TaskLogEntry {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO task_logs (id, task_id, agent_id, level, message, data_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, taskId, agentId, level, message, data ? JSON.stringify(data) : null, now);

  return { id, taskId, agentId, level, message, data, timestamp: now };
}

export function getTaskLogs(taskId: string, limit: number = 100): TaskLogEntry[] {
  const db = getDb();
  return (db.prepare(`
    SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at ASC LIMIT ?
  `).all(taskId, limit) as any[]).map(mapLogRow);
}

export function getRecentLogs(limit: number = 50): TaskLogEntry[] {
  const db = getDb();
  return (db.prepare(`
    SELECT * FROM task_logs ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[]).map(mapLogRow);
}

// ─── Stats ──────────────────────────────────────────────

export function getTaskStats(): { total: number; completed: number; failed: number; running: number; queued: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued
    FROM tasks
  `).get() as any;

  return {
    total: row.total ?? 0,
    completed: row.completed ?? 0,
    failed: row.failed ?? 0,
    running: row.running ?? 0,
    queued: row.queued ?? 0,
  };
}

// ─── Row Mappers ────────────────────────────────────────

function mapTaskRow(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    assignedAgent: row.assigned_agent,
    parentTaskId: row.parent_task_id,
    input: JSON.parse(row.input_json || '{}'),
    output: row.output_json ? JSON.parse(row.output_json) : null,
    requiresApproval: !!row.requires_approval,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function mapLogRow(row: any): TaskLogEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    agentId: row.agent_id,
    level: row.level,
    message: row.message,
    data: row.data_json ? JSON.parse(row.data_json) : undefined,
    timestamp: row.created_at,
  };
}
