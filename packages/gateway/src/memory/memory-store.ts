import { v4 as uuid } from 'uuid';
import { getDb } from '../db/database.js';
import type { SemanticMemory, EpisodicMemory, MemoryCategory } from '@agent-dashboard/shared';

// ─── Semantic Memory ────────────────────────────────────

export function createSemanticMemory(
  category: MemoryCategory,
  key: string,
  value: string,
  source: string,
  confidence: number = 1.0
): SemanticMemory {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO semantic_memory (id, category, key, value, confidence, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, category, key, value, confidence, source, now, now);

  return { id, category, key, value, confidence, source, createdAt: now, updatedAt: now };
}

export function updateSemanticMemory(
  id: string,
  updates: Partial<Pick<SemanticMemory, 'value' | 'confidence' | 'category'>>
): SemanticMemory | null {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = getSemanticMemoryById(id);
  if (!existing) return null;

  const newValue = updates.value ?? existing.value;
  const newConfidence = updates.confidence ?? existing.confidence;
  const newCategory = updates.category ?? existing.category;

  db.prepare(`
    UPDATE semantic_memory
    SET value = ?, confidence = ?, category = ?, updated_at = ?
    WHERE id = ?
  `).run(newValue, newConfidence, newCategory, now, id);

  return { ...existing, value: newValue, confidence: newConfidence, category: newCategory, updatedAt: now };
}

export function getSemanticMemoryById(id: string): SemanticMemory | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM semantic_memory WHERE id = ?').get(id) as any;
  return row ? mapSemanticRow(row) : null;
}

export function searchSemanticMemory(query: string, category?: MemoryCategory, limit: number = 20): SemanticMemory[] {
  const db = getDb();
  const pattern = `%${query}%`;

  if (category) {
    return (db.prepare(`
      SELECT * FROM semantic_memory
      WHERE category = ? AND (key LIKE ? OR value LIKE ?)
      ORDER BY updated_at DESC LIMIT ?
    `).all(category, pattern, pattern, limit) as any[]).map(mapSemanticRow);
  }

  return (db.prepare(`
    SELECT * FROM semantic_memory
    WHERE key LIKE ? OR value LIKE ?
    ORDER BY updated_at DESC LIMIT ?
  `).all(pattern, pattern, limit) as any[]).map(mapSemanticRow);
}

export function listSemanticMemory(category?: MemoryCategory, limit: number = 50): SemanticMemory[] {
  const db = getDb();

  if (category) {
    return (db.prepare(`
      SELECT * FROM semantic_memory WHERE category = ?
      ORDER BY updated_at DESC LIMIT ?
    `).all(category, limit) as any[]).map(mapSemanticRow);
  }

  return (db.prepare(`
    SELECT * FROM semantic_memory ORDER BY updated_at DESC LIMIT ?
  `).all(limit) as any[]).map(mapSemanticRow);
}

export function deleteSemanticMemory(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM semantic_memory WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Episodic Memory ────────────────────────────────────

export function createEpisodicMemory(
  agentId: string,
  summary: string,
  outcome: 'success' | 'partial' | 'failed',
  options: { taskId?: string; context?: Record<string, unknown>; lessons?: string } = {}
): EpisodicMemory {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  const contextJson = JSON.stringify(options.context ?? {});

  db.prepare(`
    INSERT INTO episodic_memory (id, agent_id, task_id, summary, context_json, outcome, lessons, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, agentId, options.taskId ?? null, summary, contextJson, outcome, options.lessons ?? '', now);

  return {
    id,
    agentId,
    taskId: options.taskId ?? null,
    summary,
    context: options.context ?? {},
    outcome,
    lessons: options.lessons ?? '',
    createdAt: now,
  };
}

export function searchEpisodicMemory(query: string, agentId?: string, limit: number = 20): EpisodicMemory[] {
  const db = getDb();
  const pattern = `%${query}%`;

  if (agentId) {
    return (db.prepare(`
      SELECT * FROM episodic_memory
      WHERE agent_id = ? AND (summary LIKE ? OR lessons LIKE ?)
      ORDER BY created_at DESC LIMIT ?
    `).all(agentId, pattern, pattern, limit) as any[]).map(mapEpisodicRow);
  }

  return (db.prepare(`
    SELECT * FROM episodic_memory
    WHERE summary LIKE ? OR lessons LIKE ?
    ORDER BY created_at DESC LIMIT ?
  `).all(pattern, pattern, limit) as any[]).map(mapEpisodicRow);
}

export function listEpisodicMemory(agentId?: string, limit: number = 50): EpisodicMemory[] {
  const db = getDb();

  if (agentId) {
    return (db.prepare(`
      SELECT * FROM episodic_memory WHERE agent_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(agentId, limit) as any[]).map(mapEpisodicRow);
  }

  return (db.prepare(`
    SELECT * FROM episodic_memory ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[]).map(mapEpisodicRow);
}

export function deleteEpisodicMemory(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM episodic_memory WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Row Mappers ────────────────────────────────────────

function mapSemanticRow(row: any): SemanticMemory {
  return {
    id: row.id,
    category: row.category,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEpisodicRow(row: any): EpisodicMemory {
  return {
    id: row.id,
    agentId: row.agent_id,
    taskId: row.task_id,
    summary: row.summary,
    context: JSON.parse(row.context_json || '{}'),
    outcome: row.outcome,
    lessons: row.lessons,
    createdAt: row.created_at,
  };
}
