// ─── Agent Types ────────────────────────────────────────

export type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  modelPreference?: string;
  maxConcurrentTasks: number;
}

export interface AgentState {
  id: string;
  definitionId: string;
  status: AgentStatus;
  currentTaskId: string | null;
  lastActivity: string; // ISO datetime
  tokenUsage: { prompt: number; completion: number; total: number };
  errorCount: number;
}

// ─── Task Types ─────────────────────────────────────────

export type TaskStatus =
  | 'created'
  | 'queued'
  | 'assigned'
  | 'running'
  | 'review'
  | 'completed'
  | 'failed'
  | 'rejected';

export type TaskType = 'scheduled' | 'reactive' | 'manual' | 'chained';

export type TaskPriority = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent: string | null;
  parentTaskId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  requiresApproval: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TaskCreateInput {
  title: string;
  description: string;
  type: TaskType;
  priority?: TaskPriority;
  assignedAgent?: string;
  parentTaskId?: string;
  input?: Record<string, unknown>;
  requiresApproval?: boolean;
}

// ─── Memory Types ───────────────────────────────────────

export type MemoryCategory = 'supplier' | 'client' | 'rule' | 'preference' | 'general';

export interface SemanticMemory {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  confidence: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodicMemory {
  id: string;
  agentId: string;
  taskId: string | null;
  summary: string;
  context: Record<string, unknown>;
  outcome: 'success' | 'partial' | 'failed';
  lessons: string;
  createdAt: string;
}

export interface MemorySearchResult {
  id: string;
  memoryType: 'semantic' | 'episodic';
  text: string;
  score: number;
}

// ─── WebSocket Message Types ────────────────────────────

export type WsMessageType =
  // Client → Server
  | 'task:create'
  | 'task:approve'
  | 'task:reject'
  | 'task:cancel'
  | 'agent:interrupt'
  | 'memory:search'
  | 'memory:create'
  | 'memory:update'
  | 'memory:delete'
  | 'subscribe'
  // Server → Client
  | 'state:snapshot'
  | 'agent:updated'
  | 'task:updated'
  | 'task:log'
  | 'memory:result'
  | 'error';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  id: string;
  timestamp: string;
  payload: T;
}

// ─── State Snapshot (sent to dashboard on connect) ──────

export interface DashboardSnapshot {
  agents: AgentState[];
  tasks: Task[];
  recentLogs: TaskLogEntry[];
  stats: SystemStats;
}

export interface TaskLogEntry {
  id: string;
  taskId: string;
  agentId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface SystemStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeAgents: number;
  totalTokensToday: number;
  estimatedCostToday: number;
}

// ─── Model Configuration ────────────────────────────────

export interface ModelConfig {
  id: string;
  provider: 'anthropic' | 'openai' | 'openrouter' | 'ollama';
  model: string;
  apiKeyEnv: string;
  maxTokens: number;
  temperature: number;
  costPerInputToken: number;
  costPerOutputToken: number;
}

export interface ModelsConfig {
  primary: string;
  fallback: string;
  models: Record<string, ModelConfig>;
}

// ─── Agent Tool Types ───────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  result: unknown;
  error?: string;
}
