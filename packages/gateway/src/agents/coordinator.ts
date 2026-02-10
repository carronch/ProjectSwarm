import type { AgentDefinition, AgentState, Task } from '@agent-dashboard/shared';
import { BaseAgent, type AgentEvent, type AgentEventListener } from './base-agent.js';
import { createLlmProvider, type LlmProvider } from './llm-provider.js';
import * as taskStore from '../tasks/task-store.js';
import { logAudit } from '../db/audit.js';

export class AgentCoordinator {
  private agents: Map<string, BaseAgent> = new Map();
  private definitions: Map<string, AgentDefinition> = new Map();
  private llmProvider: LlmProvider;
  private listeners: AgentEventListener[] = [];
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(llmProvider: LlmProvider) {
    this.llmProvider = llmProvider;
  }

  // ─── Agent Management ─────────────────────────────

  registerAgent(definition: AgentDefinition): BaseAgent {
    this.definitions.set(definition.id, definition);
    const agent = new BaseAgent(definition, this.llmProvider);

    // Forward agent events to coordinator listeners
    agent.on((event) => {
      for (const listener of this.listeners) {
        listener(event);
      }
    });

    this.agents.set(definition.id, agent);
    console.log(`Registered agent: ${definition.name} (${definition.id})`);
    return agent;
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  getAgentStates(): AgentState[] {
    return Array.from(this.agents.values()).map(a => a.state);
  }

  // ─── Event System ─────────────────────────────────

  on(listener: AgentEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // ─── Task Assignment ──────────────────────────────

  async assignTask(task: Task): Promise<void> {
    // If task has a specific agent assignment, use that
    if (task.assignedAgent) {
      const agent = this.agents.get(task.assignedAgent);
      if (!agent) {
        taskStore.updateTaskStatus(task.id, 'failed', { output: { error: `Agent ${task.assignedAgent} not found` } });
        return;
      }
      if (agent.state.status !== 'idle') {
        // Queue it — the agent will pick it up when idle
        taskStore.updateTaskStatus(task.id, 'queued');
        return;
      }
      await this.runTaskOnAgent(agent, task);
      return;
    }

    // Find best available agent based on capabilities
    const agent = this.findBestAgent(task);
    if (!agent) {
      taskStore.updateTaskStatus(task.id, 'queued');
      return;
    }

    await this.runTaskOnAgent(agent, task);
  }

  private findBestAgent(task: Task): BaseAgent | undefined {
    // Simple strategy: find an idle agent with matching capabilities
    const taskKeywords = `${task.title} ${task.description}`.toLowerCase();

    let bestAgent: BaseAgent | undefined;
    let bestScore = 0;

    for (const agent of this.agents.values()) {
      if (agent.state.status !== 'idle') continue;

      // Score based on keyword overlap between task and capabilities
      const score = agent.definition.capabilities.reduce((acc, cap) => {
        return acc + (taskKeywords.includes(cap.toLowerCase()) ? 1 : 0);
      }, 0);

      if (score > bestScore || (!bestAgent && agent.state.status === 'idle')) {
        bestAgent = agent;
        bestScore = score;
      }
    }

    return bestAgent;
  }

  private async runTaskOnAgent(agent: BaseAgent, task: Task): Promise<void> {
    const updatedTask = taskStore.updateTaskStatus(task.id, 'running', { assignedAgent: agent.definition.id });
    if (!updatedTask) return;

    logAudit(agent.definition.id, 'task:assigned', 'task', task.id, { agent: agent.definition.id });

    const result = await agent.executeTask(updatedTask);

    if (result.success) {
      if (updatedTask.requiresApproval) {
        taskStore.updateTaskStatus(task.id, 'review', { output: result.output });
      } else {
        taskStore.updateTaskStatus(task.id, 'completed', { output: result.output });
      }
    } else {
      taskStore.updateTaskStatus(task.id, 'failed', { output: result.output });
    }

    // Check for queued tasks this agent could pick up
    this.checkQueue(agent.definition.id);
  }

  private async checkQueue(agentId: string): Promise<void> {
    const nextTask = taskStore.getNextQueuedTask(agentId);
    if (nextTask) {
      const agent = this.agents.get(agentId);
      if (agent && agent.state.status === 'idle') {
        await this.runTaskOnAgent(agent, nextTask);
      }
    }
  }

  // ─── Polling Loop ─────────────────────────────────

  startPolling(intervalMs: number = 5000): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      // Check for queued tasks and assign them
      const queuedTasks = taskStore.listTasks({ status: 'queued', limit: 10 });
      for (const task of queuedTasks) {
        await this.assignTask(task);
      }
    }, intervalMs);

    console.log(`Agent coordinator polling started (${intervalMs}ms interval)`);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
