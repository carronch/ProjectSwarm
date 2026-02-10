import { v4 as uuid } from 'uuid';
import type {
  AgentDefinition,
  AgentState,
  Task,
  ToolDefinition,
  ToolResult,
  TaskLogEntry,
} from '@agent-dashboard/shared';
import { type LlmProvider, type LlmMessage, type LlmResponse } from './llm-provider.js';
import { addTaskLog } from '../tasks/task-store.js';
import { createEpisodicMemory, searchSemanticMemory } from '../memory/memory-store.js';
import { recordTokenUsage } from '../db/token-usage.js';
import { logAudit } from '../db/audit.js';

export interface AgentToolHandler {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export type AgentEventListener = (event: AgentEvent) => void;

export type AgentEvent =
  | { type: 'status_changed'; agent: AgentState }
  | { type: 'task_log'; entry: TaskLogEntry }
  | { type: 'task_completed'; task: Task; agent: AgentState }
  | { type: 'task_failed'; task: Task; error: string; agent: AgentState }
  | { type: 'thinking'; agent: AgentState; content: string };

export class BaseAgent {
  public readonly definition: AgentDefinition;
  public state: AgentState;

  private llm: LlmProvider;
  private tools: Map<string, AgentToolHandler> = new Map();
  private listeners: AgentEventListener[] = [];
  private conversationHistory: LlmMessage[] = [];

  constructor(definition: AgentDefinition, llm: LlmProvider) {
    this.definition = definition;
    this.llm = llm;

    this.state = {
      id: uuid(),
      definitionId: definition.id,
      status: 'idle',
      currentTaskId: null,
      lastActivity: new Date().toISOString(),
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
      errorCount: 0,
    };
  }

  // ─── Tool Registration ──────────────────────────────

  registerTool(handler: AgentToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  // ─── Event System ───────────────────────────────────

  on(listener: AgentEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private updateStatus(status: AgentState['status']): void {
    this.state = { ...this.state, status, lastActivity: new Date().toISOString() };
    this.emit({ type: 'status_changed', agent: this.state });
  }

  // ─── Task Execution ─────────────────────────────────

  async executeTask(task: Task): Promise<{ success: boolean; output: Record<string, unknown> }> {
    this.state.currentTaskId = task.id;
    this.updateStatus('busy');
    this.conversationHistory = [];

    try {
      // Build system prompt with memory context
      const systemPrompt = await this.buildSystemPrompt(task);

      // Initial user message with the task
      this.conversationHistory.push({
        role: 'user',
        content: this.buildTaskMessage(task),
      });

      this.log(task.id, 'info', `Starting task: ${task.title}`);

      // Agent loop: LLM generates response, we execute tool calls, repeat
      const maxIterations = 10;
      let iteration = 0;
      let finalContent = '';

      while (iteration < maxIterations) {
        iteration++;

        const response = await this.llm.chat(
          systemPrompt,
          this.conversationHistory,
          this.getToolDefinitions(),
        );

        // Track token usage
        this.state.tokenUsage.prompt += response.promptTokens;
        this.state.tokenUsage.completion += response.completionTokens;
        this.state.tokenUsage.total += response.promptTokens + response.completionTokens;

        recordTokenUsage(
          this.definition.id,
          response.model,
          response.promptTokens,
          response.completionTokens,
          0 // Cost calculated later based on model config
        );

        if (response.content) {
          finalContent = response.content;
          this.emit({ type: 'thinking', agent: this.state, content: response.content });
          this.log(task.id, 'debug', `Agent thinking: ${response.content.substring(0, 200)}`);
        }

        // If no tool calls, we're done
        if (response.toolCalls.length === 0) {
          break;
        }

        // Execute tool calls
        const toolResults: ToolResult[] = [];
        for (const call of response.toolCalls) {
          this.log(task.id, 'info', `Calling tool: ${call.name}`, { args: call.arguments });
          logAudit(this.definition.id, 'agent:tool_call', 'task', task.id, {
            tool: call.name,
            args: call.arguments,
          });

          const handler = this.tools.get(call.name);
          if (!handler) {
            toolResults.push({ callId: call.id, result: null, error: `Unknown tool: ${call.name}` });
            continue;
          }

          try {
            const result = await handler.execute(call.arguments);
            toolResults.push({ callId: call.id, result });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            toolResults.push({ callId: call.id, result: null, error: errorMsg });
            this.log(task.id, 'error', `Tool ${call.name} failed: ${errorMsg}`);
          }
        }

        // Add assistant response and tool results to conversation
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content || `[Used tools: ${response.toolCalls.map(c => c.name).join(', ')}]`,
        });

        this.conversationHistory.push({
          role: 'user',
          content: `Tool results:\n${toolResults.map(r =>
            `${r.callId}: ${r.error ? `ERROR: ${r.error}` : JSON.stringify(r.result)}`
          ).join('\n')}`,
        });
      }

      // Success: record episodic memory
      const output = { content: finalContent, iterations: iteration };
      createEpisodicMemory(
        this.definition.id,
        `Completed task "${task.title}": ${finalContent.substring(0, 500)}`,
        'success',
        { taskId: task.id, context: { input: task.input }, lessons: '' }
      );

      this.state.currentTaskId = null;
      this.updateStatus('idle');
      this.log(task.id, 'info', `Task completed after ${iteration} iterations`);
      this.emit({ type: 'task_completed', task, agent: this.state });

      return { success: true, output };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state.errorCount++;
      this.state.currentTaskId = null;
      this.updateStatus('error');

      this.log(task.id, 'error', `Task failed: ${errorMsg}`);
      createEpisodicMemory(
        this.definition.id,
        `Failed task "${task.title}": ${errorMsg}`,
        'failed',
        { taskId: task.id, context: { error: errorMsg }, lessons: errorMsg }
      );

      this.emit({ type: 'task_failed', task, error: errorMsg, agent: this.state });
      return { success: false, output: { error: errorMsg } };
    }
  }

  // ─── Helpers ────────────────────────────────────────

  private async buildSystemPrompt(task: Task): Promise<string> {
    // Pull relevant memories for context
    const relevantMemories = searchSemanticMemory(task.title, undefined, 10);
    const memoryContext = relevantMemories.length > 0
      ? `\n\nRelevant memories:\n${relevantMemories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n')}`
      : '';

    return `You are ${this.definition.name}, a specialized AI agent.
Role: ${this.definition.role}
Description: ${this.definition.description}
Capabilities: ${this.definition.capabilities.join(', ')}

You are part of an agent coordination system. Execute tasks efficiently and accurately.
When you need to perform actions, use the available tools.
When your task is complete, provide a clear summary of what was done.
${memoryContext}`;
  }

  private buildTaskMessage(task: Task): string {
    let msg = `Task: ${task.title}\n`;
    if (task.description) msg += `Description: ${task.description}\n`;
    if (Object.keys(task.input).length > 0) {
      msg += `Input:\n${JSON.stringify(task.input, null, 2)}\n`;
    }
    msg += `\nPriority: ${task.priority} (1=urgent, 5=background)\n`;
    msg += `Type: ${task.type}\n`;
    return msg;
  }

  private log(taskId: string, level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: Record<string, unknown>): void {
    const entry = addTaskLog(taskId, this.definition.id, level, message, data);
    this.emit({ type: 'task_log', entry });
  }
}
