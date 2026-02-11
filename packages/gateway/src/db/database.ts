import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'agent-dashboard.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();
  const schemaPath = join(process.cwd(), '..', '..', 'db', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  // Split on semicolons and execute each statement
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    // Skip PRAGMA statements handled in getDb()
    if (stmt.toUpperCase().startsWith('PRAGMA')) continue;
    database.exec(stmt + ';');
  }

  console.log(`Database initialized at ${DB_PATH}`);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
