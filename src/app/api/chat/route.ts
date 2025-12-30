import { createUnifiedAgent } from '@/agents/web-agent';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestBody {
  messages: ChatMessage[];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const agent = createUnifiedAgent();

    const result = await agent.stream({ messages });

    // Create a ReadableStream from the textStream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({ error: 'Chat request failed' }, { status: 500 });
  }
}
