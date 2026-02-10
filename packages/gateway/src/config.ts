import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { AgentDefinition, ModelsConfig } from '@agent-dashboard/shared';

const CONFIG_DIR = join(process.cwd(), '..', '..', 'config');

export interface AppConfig {
  agents: AgentDefinition[];
  models: ModelsConfig;
}

export function loadConfig(): AppConfig {
  return {
    agents: loadJsonConfig<AgentDefinition[]>('agents.json', defaultAgents()),
    models: loadJsonConfig<ModelsConfig>('models.json', defaultModelsConfig()),
  };
}

function loadJsonConfig<T>(filename: string, fallback: T): T {
  const filePath = join(CONFIG_DIR, filename);
  if (!existsSync(filePath)) {
    console.warn(`Config file not found: ${filePath}, using defaults`);
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`Error reading ${filePath}: ${err}, using defaults`);
    return fallback;
  }
}

function defaultAgents(): AgentDefinition[] {
  return [
    {
      id: 'coordinator',
      name: 'Coordinator',
      role: 'Task Router & Coordinator',
      description: 'Routes tasks to specialized agents, manages priorities, and oversees workflow',
      capabilities: ['routing', 'planning', 'coordination', 'prioritization'],
      maxConcurrentTasks: 1,
    },
    {
      id: 'general',
      name: 'General Assistant',
      role: 'General Purpose Agent',
      description: 'Handles miscellaneous tasks, research, and analysis',
      capabilities: ['research', 'analysis', 'writing', 'summarization', 'general'],
      maxConcurrentTasks: 1,
    },
  ];
}

function defaultModelsConfig(): ModelsConfig {
  return {
    primary: 'claude-sonnet',
    fallback: 'claude-haiku',
    models: {
      'claude-sonnet': {
        id: 'claude-sonnet',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        maxTokens: 4096,
        temperature: 0.7,
        costPerInputToken: 0.000003,
        costPerOutputToken: 0.000015,
      },
      'claude-haiku': {
        id: 'claude-haiku',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
        maxTokens: 4096,
        temperature: 0.7,
        costPerInputToken: 0.0000008,
        costPerOutputToken: 0.000004,
      },
    },
  };
}
