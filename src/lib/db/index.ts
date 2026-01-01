import { createClient, Client } from '@libsql/client';
import { join } from 'path';

// Lazy initialization to avoid connection during build
let _db: Client | null = null;

export function getDb(): Client {
  if (!_db) {
    const localDbPath = join(process.cwd(), 'data', 'local.db');
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL || `file:${localDbPath}`,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

let dbInitialized = false;

// Initialize schema (runs once per cold start)
export async function initDb() {
  if (dbInitialized) return;

  await getDb().batch([
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
