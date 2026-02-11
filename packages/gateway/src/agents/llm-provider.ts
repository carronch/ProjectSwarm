import Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition, ToolCall, ModelConfig } from '@agent-dashboard/shared';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  content: string;
  toolCalls: ToolCall[];
  promptTokens: number;
  completionTokens: number;
  model: string;
  stopReason: string;
}

export interface LlmProvider {
  chat(
    systemPrompt: string,
    messages: LlmMessage[],
    tools?: ToolDefinition[],
  ): Promise<LlmResponse>;
}

// ─── Anthropic Provider ─────────────────────────────────

export function createAnthropicProvider(config: ModelConfig): LlmProvider {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing API key: set ${config.apiKeyEnv} environment variable`);
  }

  const client = new Anthropic({ apiKey });

  return {
    async chat(systemPrompt, messages, tools) {
      const anthropicTools = tools?.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool['input_schema'],
      }));

      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        ...(anthropicTools?.length ? { tools: anthropicTools } : {}),
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        .map(block => ({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        }));

      return {
        content: textContent,
        toolCalls,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        model: config.model,
        stopReason: response.stop_reason ?? 'end_turn',
      };
    },
  };
}

// ─── Provider Factory ───────────────────────────────────

export function createLlmProvider(config: ModelConfig): LlmProvider {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicProvider(config);
    // Future: add openai, openrouter, ollama providers
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
