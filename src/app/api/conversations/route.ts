import { db, initDb } from '@/lib/db';

// GET /api/conversations - list all
export async function GET() {
  try {
    await initDb();

    const result = await db.execute(
      'SELECT * FROM conversations ORDER BY updated_at DESC'
    );

    return Response.json(
      result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
    );
  } catch (error) {
    console.error('GET /api/conversations error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - create new
export async function POST() {
  await initDb();

  const id = crypto.randomUUID();
  const now = Date.now();

  await db.execute({
    sql: 'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    args: [id, 'New conversation', now, now],
  });

  return Response.json({
    id,
    title: 'New conversation',
    createdAt: now,
    updatedAt: now,
  });
}
