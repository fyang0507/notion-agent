import { getDb, initDb } from '@/lib/db';

interface OldMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface OldConversation {
  id: string;
  title: string;
  messages: OldMessage[];
  createdAt: number;
  updatedAt: number;
}

export async function POST(req: Request) {
  try {
    await initDb();

    const oldData: OldConversation[] = await req.json();

    if (!Array.isArray(oldData)) {
      return Response.json({ error: 'Invalid data format' }, { status: 400 });
    }

    let migratedCount = 0;

    for (const conv of oldData) {
      // Insert conversation (ignore if exists)
      await getDb().execute({
        sql: 'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
        args: [conv.id, conv.title, conv.createdAt, conv.updatedAt],
      });

      // Check if conversation was actually inserted (not already existing)
      const existing = await getDb().execute({
        sql: 'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
        args: [conv.id],
      });

      const existingMsgCount = Number(existing.rows[0]?.count ?? 0);
      if (existingMsgCount > 0) {
        // Conversation already has messages, skip
        continue;
      }

      // Insert messages (convert old format to UIMessage)
      for (let i = 0; i < conv.messages.length; i++) {
        const msg = conv.messages[i];
        const uiMessage = {
          id: msg.id,
          role: msg.role,
          parts: [{ type: 'text', text: msg.content }],
          createdAt: new Date(msg.timestamp),
        };

        await getDb().execute({
          sql: 'INSERT OR IGNORE INTO messages (id, conversation_id, content, sequence_order) VALUES (?, ?, ?, ?)',
          args: [msg.id, conv.id, JSON.stringify(uiMessage), i],
        });
      }

      migratedCount++;
    }

    return Response.json({ success: true, migratedCount });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: 'Migration failed' }, { status: 500 });
  }
}
