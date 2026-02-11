import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { initDb, closeDb } from './database.js';

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'agent-dashboard.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

console.log('Initializing database...');
initDb();
closeDb();
console.log('Done.');
