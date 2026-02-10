-- Agent Dashboard Schema
-- SQLite database for memory, tasks, and audit logging

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── Semantic Memory ────────────────────────────────────
-- Core facts about businesses, clients, suppliers, rules
CREATE TABLE IF NOT EXISTS semantic_memory (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('supplier', 'client', 'rule', 'preference', 'general')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_semantic_category ON semantic_memory(category);
CREATE INDEX IF NOT EXISTS idx_semantic_key ON semantic_memory(key);

-- ─── Episodic Memory ────────────────────────────────────
-- Past interactions and outcomes
CREATE TABLE IF NOT EXISTS episodic_memory (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  summary TEXT NOT NULL,
  context_json TEXT NOT NULL DEFAULT '{}',
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'partial', 'failed')),
  lessons TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_episodic_agent ON episodic_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_episodic_task ON episodic_memory(task_id);
CREATE INDEX IF NOT EXISTS idx_episodic_outcome ON episodic_memory(outcome);

-- ─── Tasks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('scheduled', 'reactive', 'manual', 'chained')),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'queued', 'assigned', 'running', 'review', 'completed', 'failed', 'rejected')),
  priority INTEGER NOT NULL DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  assigned_agent TEXT,
  parent_task_id TEXT REFERENCES tasks(id),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- ─── Task Logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  agent_id TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_level ON task_logs(level);

-- ─── Audit Log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,        -- agent id or 'user'
  action TEXT NOT NULL,       -- e.g. 'task:create', 'memory:update', 'agent:tool_call'
  resource_type TEXT NOT NULL, -- 'task', 'memory', 'agent'
  resource_id TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

-- ─── Token Usage Tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  estimated_cost REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at);
