import { v4 as uuid } from 'uuid';
import { getDb } from './database.js';

export interface TokenUsageEntry {
  id: string;
  agentId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
}

export function recordTokenUsage(
  agentId: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  estimatedCost: number
): TokenUsageEntry {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const totalTokens = promptTokens + completionTokens;

  db.prepare(`
    INSERT INTO token_usage (id, agent_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agentId, model, promptTokens, completionTokens, totalTokens, estimatedCost, now);

  return { id, agentId, model, promptTokens, completionTokens, totalTokens, estimatedCost, createdAt: now };
}

export function getTodayTokenStats(): { totalTokens: number; estimatedCost: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(estimated_cost), 0) as estimated_cost
    FROM token_usage
    WHERE created_at >= date('now')
  `).get() as any;

  return {
    totalTokens: row.total_tokens,
    estimatedCost: row.estimated_cost,
  };
}

export function getAgentTokenUsage(agentId: string): { totalTokens: number; estimatedCost: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(total_tokens), 0) as total_tokens,
      COALESCE(SUM(estimated_cost), 0) as estimated_cost
    FROM token_usage
    WHERE agent_id = ?
  `).get(agentId) as any;

  return {
    totalTokens: row.total_tokens,
    estimatedCost: row.estimated_cost,
  };
}
