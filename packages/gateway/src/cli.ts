import 'dotenv/config';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { initDb, closeDb } from './db/database.js';
import * as taskStore from './tasks/task-store.js';
import * as memoryStore from './memory/memory-store.js';

// Ensure data directory exists
mkdirSync(join(process.cwd(), 'data'), { recursive: true });
initDb();

const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(): void {
  rl.question('\nagent> ', (input) => {
    const [command, ...args] = input.trim().split(/\s+/);
    if (!command) { prompt(); return; }

    try {
      switch (command) {
        case 'help':
          console.log(`
Commands:
  task create <title>        Create a new manual task
  task list [status]         List tasks (optional status filter)
  task status <id> <status>  Update task status

  memory add <category> <key> <value>   Add semantic memory
  memory list [category]                List semantic memories
  memory search <query>                 Search memories

  stats                      Show system stats
  quit                       Exit CLI
`);
          break;

        case 'task':
          handleTaskCommand(args);
          break;

        case 'memory':
          handleMemoryCommand(args);
          break;

        case 'stats':
          const s = taskStore.getTaskStats();
          console.log(`Tasks: ${s.total} total, ${s.completed} completed, ${s.failed} failed, ${s.running} running, ${s.queued} queued`);
          break;

        case 'quit':
        case 'exit':
          closeDb();
          rl.close();
          process.exit(0);

        default:
          console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
    }

    prompt();
  });
}

function handleTaskCommand(args: string[]): void {
  const [sub, ...rest] = args;

  switch (sub) {
    case 'create': {
      const title = rest.join(' ');
      if (!title) { console.log('Usage: task create <title>'); return; }
      const task = taskStore.createTask({ title, description: '', type: 'manual' });
      taskStore.updateTaskStatus(task.id, 'queued');
      console.log(`Created task: ${task.id} — "${task.title}"`);
      break;
    }
    case 'list': {
      const status = rest[0] as any;
      const tasks = taskStore.listTasks({ status: status || undefined, limit: 20 });
      if (tasks.length === 0) { console.log('No tasks found.'); return; }
      for (const t of tasks) {
        console.log(`  [${t.status}] ${t.id.slice(0, 8)} — ${t.title} (priority: ${t.priority})`);
      }
      break;
    }
    case 'status': {
      const [id, status] = rest;
      if (!id || !status) { console.log('Usage: task status <id> <status>'); return; }
      const task = taskStore.updateTaskStatus(id, status as any);
      if (task) {
        console.log(`Updated task ${id}: ${task.status}`);
      } else {
        console.log(`Task not found: ${id}`);
      }
      break;
    }
    default:
      console.log('Usage: task [create|list|status]');
  }
}

function handleMemoryCommand(args: string[]): void {
  const [sub, ...rest] = args;

  switch (sub) {
    case 'add': {
      const [category, key, ...valueParts] = rest;
      const value = valueParts.join(' ');
      if (!category || !key || !value) {
        console.log('Usage: memory add <category> <key> <value>');
        return;
      }
      const mem = memoryStore.createSemanticMemory(category as any, key, value, 'cli');
      console.log(`Created memory: ${mem.id} — [${mem.category}] ${mem.key}: ${mem.value}`);
      break;
    }
    case 'list': {
      const category = rest[0] as any;
      const memories = memoryStore.listSemanticMemory(category || undefined, 20);
      if (memories.length === 0) { console.log('No memories found.'); return; }
      for (const m of memories) {
        console.log(`  [${m.category}] ${m.key}: ${m.value} (confidence: ${(m.confidence * 100).toFixed(0)}%)`);
      }
      break;
    }
    case 'search': {
      const query = rest.join(' ');
      if (!query) { console.log('Usage: memory search <query>'); return; }
      const results = memoryStore.searchSemanticMemory(query);
      if (results.length === 0) { console.log('No results.'); return; }
      for (const m of results) {
        console.log(`  [${m.category}] ${m.key}: ${m.value}`);
      }
      break;
    }
    default:
      console.log('Usage: memory [add|list|search]');
  }
}

console.log('Agent Dashboard CLI');
console.log('Type "help" for available commands.\n');
prompt();
