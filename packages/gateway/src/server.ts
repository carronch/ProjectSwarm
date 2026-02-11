import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { mkdirSync } from 'fs';
import { join } from 'path';
import type {
  WsMessage,
  DashboardSnapshot,
  TaskCreateInput,
  Task,
} from '@agent-dashboard/shared';
import { initDb, closeDb } from './db/database.js';
import { getTodayTokenStats } from './db/token-usage.js';
import * as taskStore from './tasks/task-store.js';
import * as memoryStore from './memory/memory-store.js';
import { AgentCoordinator } from './agents/coordinator.js';
import { createLlmProvider } from './agents/llm-provider.js';
import { loadConfig } from './config.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

// Ensure data directory exists
mkdirSync(join(process.cwd(), 'data'), { recursive: true });

// Initialize database
initDb();

// Load configuration
const config = loadConfig();

// Create LLM provider
let coordinator: AgentCoordinator;
try {
  const primaryModel = config.models.models[config.models.primary];
  const llmProvider = createLlmProvider(primaryModel);
  coordinator = new AgentCoordinator(llmProvider);

  // Register agents from config
  for (const agentDef of config.agents) {
    coordinator.registerAgent(agentDef);
  }

  coordinator.startPolling();
} catch (err) {
  console.warn(`LLM provider initialization skipped: ${err instanceof Error ? err.message : err}`);
  console.warn('Dashboard will run in monitor-only mode. Set API keys to enable agents.');
  // Create coordinator without a real LLM — dashboard still works
  coordinator = new AgentCoordinator(null as any);
  for (const agentDef of config.agents) {
    coordinator.registerAgent(agentDef);
  }
}

// ─── HTTP Server (REST API for dashboard) ───────────

function handleApiRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── API Routes ─────────────────────────────────

  // GET /api/snapshot — full dashboard state
  if (path === '/api/snapshot' && req.method === 'GET') {
    const snapshot = buildSnapshot();
    res.writeHead(200);
    res.end(JSON.stringify(snapshot));
    return;
  }

  // GET /api/tasks
  if (path === '/api/tasks' && req.method === 'GET') {
    const status = url.searchParams.get('status') as any;
    const tasks = taskStore.listTasks({ status: status || undefined });
    res.writeHead(200);
    res.end(JSON.stringify(tasks));
    return;
  }

  // POST /api/tasks
  if (path === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const input: TaskCreateInput = JSON.parse(body);
        const task = taskStore.createTask(input);
        taskStore.updateTaskStatus(task.id, 'queued');
        broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: { ...task, status: 'queued' } });
        res.writeHead(201);
        res.end(JSON.stringify(task));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid task input' }));
      }
    });
    return;
  }

  // POST /api/tasks/:id/approve
  if (path.match(/^\/api\/tasks\/[^/]+\/approve$/) && req.method === 'POST') {
    const taskId = path.split('/')[3];
    const task = taskStore.updateTaskStatus(taskId, 'completed');
    if (task) {
      broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: task });
      res.writeHead(200);
      res.end(JSON.stringify(task));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Task not found' }));
    }
    return;
  }

  // POST /api/tasks/:id/reject
  if (path.match(/^\/api\/tasks\/[^/]+\/reject$/) && req.method === 'POST') {
    const taskId = path.split('/')[3];
    const task = taskStore.updateTaskStatus(taskId, 'rejected');
    if (task) {
      taskStore.updateTaskStatus(taskId, 'queued'); // Re-queue
      broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: task });
      res.writeHead(200);
      res.end(JSON.stringify(task));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Task not found' }));
    }
    return;
  }

  // GET /api/tasks/:id/logs
  if (path.match(/^\/api\/tasks\/[^/]+\/logs$/) && req.method === 'GET') {
    const taskId = path.split('/')[3];
    const logs = taskStore.getTaskLogs(taskId);
    res.writeHead(200);
    res.end(JSON.stringify(logs));
    return;
  }

  // GET /api/memory/semantic
  if (path === '/api/memory/semantic' && req.method === 'GET') {
    const query = url.searchParams.get('q') || '';
    const category = url.searchParams.get('category') as any;
    const results = query
      ? memoryStore.searchSemanticMemory(query, category || undefined)
      : memoryStore.listSemanticMemory(category || undefined);
    res.writeHead(200);
    res.end(JSON.stringify(results));
    return;
  }

  // POST /api/memory/semantic
  if (path === '/api/memory/semantic' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { category, key, value, source, confidence } = JSON.parse(body);
        const memory = memoryStore.createSemanticMemory(category, key, value, source || 'user', confidence);
        res.writeHead(201);
        res.end(JSON.stringify(memory));
      } catch (err) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid memory input' }));
      }
    });
    return;
  }

  // DELETE /api/memory/semantic/:id
  if (path.match(/^\/api\/memory\/semantic\/[^/]+$/) && req.method === 'DELETE') {
    const memId = path.split('/')[4];
    const deleted = memoryStore.deleteSemanticMemory(memId);
    res.writeHead(deleted ? 200 : 404);
    res.end(JSON.stringify({ deleted }));
    return;
  }

  // GET /api/memory/episodic
  if (path === '/api/memory/episodic' && req.method === 'GET') {
    const query = url.searchParams.get('q') || '';
    const agentId = url.searchParams.get('agent') || undefined;
    const results = query
      ? memoryStore.searchEpisodicMemory(query, agentId)
      : memoryStore.listEpisodicMemory(agentId);
    res.writeHead(200);
    res.end(JSON.stringify(results));
    return;
  }

  // GET /api/agents
  if (path === '/api/agents' && req.method === 'GET') {
    const agents = coordinator.getAgentStates();
    res.writeHead(200);
    res.end(JSON.stringify(agents));
    return;
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

const httpServer = createServer(handleApiRequest);

// ─── WebSocket Server ───────────────────────────────

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const wsClients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  console.log(`WebSocket client connected (${wsClients.size} total)`);

  // Send initial snapshot
  const snapshot = buildSnapshot();
  sendWs(ws, { type: 'state:snapshot', id: uuid(), timestamp: new Date().toISOString(), payload: snapshot });

  ws.on('message', (data) => {
    try {
      const msg: WsMessage = JSON.parse(data.toString());
      handleWsMessage(ws, msg);
    } catch {
      sendWs(ws, { type: 'error', id: uuid(), timestamp: new Date().toISOString(), payload: { error: 'Invalid message format' } });
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    console.log(`WebSocket client disconnected (${wsClients.size} total)`);
  });
});

function handleWsMessage(ws: WebSocket, msg: WsMessage): void {
  switch (msg.type) {
    case 'task:create': {
      const input = msg.payload as TaskCreateInput;
      const task = taskStore.createTask(input);
      taskStore.updateTaskStatus(task.id, 'queued');
      broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: { ...task, status: 'queued' } });
      break;
    }
    case 'task:approve': {
      const { taskId } = msg.payload as { taskId: string };
      const task = taskStore.updateTaskStatus(taskId, 'completed');
      if (task) broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: task });
      break;
    }
    case 'task:reject': {
      const { taskId } = msg.payload as { taskId: string };
      taskStore.updateTaskStatus(taskId, 'queued');
      const task = taskStore.getTask(taskId);
      if (task) broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: task });
      break;
    }
    case 'memory:search': {
      const { query, category } = msg.payload as { query: string; category?: string };
      const results = memoryStore.searchSemanticMemory(query, category as any);
      sendWs(ws, { type: 'memory:result', id: uuid(), timestamp: new Date().toISOString(), payload: results });
      break;
    }
    default:
      sendWs(ws, { type: 'error', id: uuid(), timestamp: new Date().toISOString(), payload: { error: `Unknown message type: ${msg.type}` } });
  }
}

function sendWs(ws: WebSocket, msg: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastWs(msg: WsMessage): void {
  const data = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Forward coordinator events to WebSocket clients
coordinator.on((event) => {
  switch (event.type) {
    case 'status_changed':
      broadcastWs({ type: 'agent:updated', id: uuid(), timestamp: new Date().toISOString(), payload: event.agent });
      break;
    case 'task_log':
      broadcastWs({ type: 'task:log', id: uuid(), timestamp: new Date().toISOString(), payload: event.entry });
      break;
    case 'task_completed':
    case 'task_failed':
      broadcastWs({ type: 'task:updated', id: uuid(), timestamp: new Date().toISOString(), payload: taskStore.getTask(event.task.id) });
      broadcastWs({ type: 'agent:updated', id: uuid(), timestamp: new Date().toISOString(), payload: event.agent });
      break;
  }
});

// ─── Snapshot Builder ───────────────────────────────

function buildSnapshot(): DashboardSnapshot {
  const agents = coordinator.getAgentStates();
  const tasks = taskStore.listTasks({ limit: 100 });
  const recentLogs = taskStore.getRecentLogs(50);
  const taskStats = taskStore.getTaskStats();
  const tokenStats = getTodayTokenStats();

  return {
    agents,
    tasks,
    recentLogs,
    stats: {
      totalTasks: taskStats.total,
      completedTasks: taskStats.completed,
      failedTasks: taskStats.failed,
      activeAgents: agents.filter(a => a.status === 'busy').length,
      totalTokensToday: tokenStats.totalTokens,
      estimatedCostToday: tokenStats.estimatedCost,
    },
  };
}

// ─── Start Server ───────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\nAgent Dashboard Gateway`);
  console.log(`─────────────────────────`);
  console.log(`HTTP API:    http://localhost:${PORT}/api`);
  console.log(`WebSocket:   ws://localhost:${PORT}/ws`);
  console.log(`Dashboard:   http://localhost:3000`);
  console.log(`Agents:      ${coordinator.getAgentStates().length} registered`);
  console.log(`─────────────────────────\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  coordinator.stopPolling();
  wss.close();
  httpServer.close();
  closeDb();
  process.exit(0);
});
