import { v4 as uuid } from 'uuid';
import { getDb } from './database.js';

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export function logAudit(
  actor: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>
): AuditEntry {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO audit_log (id, actor, action, resource_type, resource_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, actor, action, resourceType, resourceId, details ? JSON.stringify(details) : null, now);

  return { id, actor, action, resourceType, resourceId, details, createdAt: now };
}

export function getAuditLog(limit: number = 100, resourceType?: string): AuditEntry[] {
  const db = getDb();

  if (resourceType) {
    return (db.prepare(`
      SELECT * FROM audit_log WHERE resource_type = ? ORDER BY created_at DESC LIMIT ?
    `).all(resourceType, limit) as any[]).map(mapAuditRow);
  }

  return (db.prepare(`
    SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?
  `).all(limit) as any[]).map(mapAuditRow);
}

function mapAuditRow(row: any): AuditEntry {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: row.details_json ? JSON.parse(row.details_json) : undefined,
    createdAt: row.created_at,
  };
}
