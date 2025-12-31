import { createUnifiedAgent } from '@/agents';
import { db, initDb } from '@/lib/db';
import { convertToModelMessages, type UIMessage } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ChatRequestBody {
  conversationId?: string;  // From sendMessage options.body OR transport body
  messages: UIMessage[];
}

export async function POST(req: Request) {
  try {
    await initDb();

    const body = (await req.json()) as ChatRequestBody;
    const { conversationId, messages: inputMessages } = body;

    if (!conversationId) {
      return Response.json({ error: 'conversationId is required' }, { status: 400 });
    }

    if (!inputMessages || !Array.isArray(inputMessages)) {
      return Response.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const agent = createUnifiedAgent();

    // Convert UIMessages to ModelMessages for the agent
    const modelMessages = await convertToModelMessages(inputMessages);
    const result = await agent.stream({ messages: modelMessages });

    // Use AI SDK's toUIMessageStreamResponse for proper streaming with tool parts
    return result.toUIMessageStreamResponse({
      originalMessages: inputMessages,
      generateMessageId: () => crypto.randomUUID(),
      onFinish: async ({ messages: allMessages }) => {
        try {
          // Get the count of messages already in DB
          const existingCount = await db.execute({
            sql: 'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
            args: [conversationId],
          });
          const startIndex = Number(existingCount.rows[0]?.count ?? 0);

          // Find new messages (those after the startIndex position)
          // The allMessages array includes all messages from the conversation
          const newMessages = allMessages.slice(startIndex);

          // Save new messages
          for (let i = 0; i < newMessages.length; i++) {
            const msg = newMessages[i];
            await db.execute({
              sql: 'INSERT INTO messages (id, conversation_id, content, sequence_order) VALUES (?, ?, ?, ?)',
              args: [msg.id, conversationId, JSON.stringify(msg), startIndex + i],
            });
          }

          // Update conversation timestamp and title (use first user message as title if new)
          const conv = await db.execute({
            sql: 'SELECT title FROM conversations WHERE id = ?',
            args: [conversationId],
          });

          const currentTitle = conv.rows[0]?.title as string;
          let newTitle = currentTitle;

          // Generate title from first user message if still "New conversation"
          if (currentTitle === 'New conversation') {
            const firstUserMsg = allMessages.find((m) => m.role === 'user');
            if (firstUserMsg) {
              const content =
                firstUserMsg.parts
                  ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                  .map((p) => p.text)
                  .join(' ') || '';
              newTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
            }
          }

          await db.execute({
            sql: 'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
            args: [newTitle, Date.now(), conversationId],
          });
        } catch (error) {
          console.error('Error persisting messages:', error);
        }
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: 'Chat request failed' }, { status: 500 });
  }
}
