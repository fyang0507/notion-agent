import { createClient } from '@libsql/client';
import { join } from 'path';

// Works for both local dev (file:) and production (Turso cloud)
const localDbPath = join(process.cwd(), 'data', 'local.db');

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
  authToken: process.env.TURSO_AUTH_TOKEN, // undefined for local, set by Vercel integration for prod
});

let dbInitialized = false;

// Initialize schema (runs once per cold start)
export async function initDb() {
  if (dbInitialized) return;

  await db.batch([
    `CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      sequence_order INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, sequence_order)`,
  ]);

  dbInitialized = true;
}
