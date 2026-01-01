import { getDb, initDb } from '@/lib/db';
import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/conversations/[id] - get with messages
export async function GET(req: NextRequest, context: RouteContext) {
  await initDb();
  const { id } = await context.params;

  const conv = await getDb().execute({
    sql: 'SELECT * FROM conversations WHERE id = ?',
    args: [id],
  });

  if (conv.rows.length === 0) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const msgs = await getDb().execute({
    sql: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence_order ASC',
    args: [id],
  });

  const row = conv.rows[0];
  return Response.json({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: msgs.rows.map((m) => JSON.parse(m.content as string)),
  });
}

// PATCH /api/conversations/[id] - rename
export async function PATCH(req: NextRequest, context: RouteContext) {
  await initDb();
  const { id } = await context.params;
  const { title } = await req.json();

  await getDb().execute({
    sql: 'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    args: [title, Date.now(), id],
  });

  return Response.json({ success: true });
}

// DELETE /api/conversations/[id]
export async function DELETE(req: NextRequest, context: RouteContext) {
  await initDb();
  const { id } = await context.params;

  // Delete messages first (foreign key), then conversation
  await getDb().execute({ sql: 'DELETE FROM messages WHERE conversation_id = ?', args: [id] });
  await getDb().execute({ sql: 'DELETE FROM conversations WHERE id = ?', args: [id] });

  return Response.json({ success: true });
}
