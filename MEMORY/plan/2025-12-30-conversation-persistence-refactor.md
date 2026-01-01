# Plan: Server-Side Conversation Storage with Full LLM Trace

## Problem Statement
- Conversations stored in browser localStorage (device-specific, no cross-device sync)
- Only `{role, content}` stored - tool calls and results are lost
- Each new message starts with incomplete history (breaks trace continuity for KV cache)
- Custom streaming implementation doesn't leverage AI SDK's built-in capabilities

## Solution
Use AI SDK's `useChat` hook + `toUIMessageStreamResponse()` for built-in tool streaming, with SQLite backend for persistence.

**Key insight**: AI SDK provides `UIMessage` format with `parts` array that handles text AND tool invocations. The `onFinish` callback enables server-side persistence.

---

## Reference Documentation

### AI SDK (Vercel)
- **useChat hook**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- **Storing messages**: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- **Chatbot tool usage**: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage
- **UIMessage type**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/ui-message

### Database (Turso - SQLite compatible)
- **Turso docs**: https://docs.turso.tech/
- **Turso local development**: https://docs.turso.tech/local-development
- **Turso + Vercel integration**: https://vercel.com/marketplace/tursocloud
- **@libsql/client**: https://github.com/tursodatabase/libsql-client-ts
- **Turso pricing**: https://turso.tech/pricing (Free: 5GB, 500M reads, 10M writes/month)

---

## Current Implementation (to be replaced)

### Files to understand:
| File | Purpose |
|------|---------|
| `src/lib/storage.ts` | localStorage read/write for conversations |
| `src/lib/types.ts` | Message and Conversation interfaces |
| `src/hooks/use-chat.ts` | Custom streaming fetch to /api/chat |
| `src/hooks/use-conversations.ts` | Conversation CRUD with localStorage |
| `src/app/api/chat/route.ts` | API route with custom ReadableStream |
| `src/agents/web-agent.ts` | ToolLoopAgent setup |
| `src/components/chat/message-item.tsx` | Message rendering (text only) |
| `src/components/chat/chat-page.tsx` | Main chat orchestration |

### Current data flow:
```
Browser localStorage
    ↓
useConversations() loads {id, title, messages[], timestamps}
    ↓
useChat() sends POST /api/chat with [{role, content}]
    ↓
API creates ToolLoopAgent, streams textStream only
    ↓
Tool calls/results are LOST (not captured)
    ↓
Only assistant text saved to localStorage
```

---

## Implementation Steps

### Phase 1: Database Setup

**1.1 Install dependency** (single package works for both local dev and Vercel/Turso)
```bash
pnpm add @libsql/client
```

**1.2 Create database connection**

Create `src/lib/db/index.ts`:
```typescript
import { createClient } from '@libsql/client';

// Works for both local dev (file:) and production (Turso cloud)
export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,  // undefined for local, set by Vercel integration for prod
});

// Initialize schema (runs once)
export async function initDb() {
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
}
```

**1.3 Environment setup**

Local dev - no env vars needed, uses `file:./data/local.db`

Production (Vercel):
1. Install Turso integration from Vercel Marketplace: https://vercel.com/marketplace/tursocloud
2. `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are auto-configured

Add to `.gitignore`:
```
data/
```

**1.4 Initialize on app start**

In `src/app/api/chat/route.ts` or a middleware:
```typescript
import { initDb } from '@/lib/db';

// Call once on cold start
let dbInitialized = false;
if (!dbInitialized) {
  await initDb();
  dbInitialized = true;
}
```

### Phase 2: API Routes

**2.1 Create conversation CRUD endpoints**

Create `src/app/api/conversations/route.ts`:
```typescript
import { db } from '@/lib/db';

// GET /api/conversations - list all
export async function GET() {
  const result = await db.execute(
    'SELECT * FROM conversations ORDER BY updated_at DESC'
  );
  return Response.json(result.rows);
}

// POST /api/conversations - create new
export async function POST() {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    args: [id, 'New conversation', now, now],
  });
  return Response.json({ id, title: 'New conversation', createdAt: now, updatedAt: now });
}
```

Create `src/app/api/conversations/[id]/route.ts`:
```typescript
import { db } from '@/lib/db';

// GET /api/conversations/[id] - get with messages
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const conv = await db.execute({
    sql: 'SELECT * FROM conversations WHERE id = ?',
    args: [params.id],
  });
  if (conv.rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });

  const msgs = await db.execute({
    sql: 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence_order ASC',
    args: [params.id],
  });

  return Response.json({
    ...conv.rows[0],
    messages: msgs.rows.map(m => JSON.parse(m.content as string)),
  });
}

// PATCH /api/conversations/[id] - rename
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { title } = await req.json();
  await db.execute({
    sql: 'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    args: [title, Date.now(), params.id],
  });
  return Response.json({ success: true });
}

// DELETE /api/conversations/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await db.execute({ sql: 'DELETE FROM conversations WHERE id = ?', args: [params.id] });
  return Response.json({ success: true });
}
```

**2.2 Refactor chat route**

Modify `src/app/api/chat/route.ts`:
```typescript
import { createUnifiedAgent } from '@/agents/web-agent';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { conversationId, messages: inputMessages } = await req.json();

  const agent = createUnifiedAgent();
  const result = await agent.stream({ messages: inputMessages });

  // Use AI SDK's toUIMessageStreamResponse for proper streaming
  return result.toUIMessageStreamResponse({
    originalMessages: inputMessages,
    onFinish: async ({ messages: outputMessages }) => {
      // Get current max sequence order
      const existing = await db.execute({
        sql: 'SELECT MAX(sequence_order) as max_seq FROM messages WHERE conversation_id = ?',
        args: [conversationId],
      });
      let seq = (existing.rows[0]?.max_seq as number) ?? -1;

      // Save new messages
      for (const msg of outputMessages) {
        seq++;
        await db.execute({
          sql: 'INSERT INTO messages (id, conversation_id, content, sequence_order) VALUES (?, ?, ?, ?)',
          args: [msg.id, conversationId, JSON.stringify(msg), seq],
        });
      }

      // Update conversation timestamp
      await db.execute({
        sql: 'UPDATE conversations SET updated_at = ? WHERE id = ?',
        args: [Date.now(), conversationId],
      });
    },
    generateMessageId: () => crypto.randomUUID(),
  });
}
```

### Phase 3: Frontend - Replace Custom Hook with useChat

**3.1 Delete custom hook**
- Remove `src/hooks/use-chat.ts` (replaced by AI SDK's useChat)

**3.2 Update use-conversations.ts**

Replace localStorage with API calls:
```typescript
import { useState, useEffect, useCallback } from 'react';

export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load conversations list on mount
  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        setConversations(data);
        if (data.length > 0) {
          setCurrentConversationId(data[0].id);
        }
        setIsLoading(false);
      });
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConversationId) return;
    fetch(`/api/conversations/${currentConversationId}`)
      .then(res => res.json())
      .then(data => setCurrentMessages(data.messages || []));
  }, [currentConversationId]);

  const createConversation = useCallback(async () => {
    const res = await fetch('/api/conversations', { method: 'POST' });
    const newConv = await res.json();
    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setCurrentMessages([]);
    return newConv;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setCurrentConversationId(remaining[0]?.id || null);
    }
  }, [currentConversationId, conversations]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  return {
    conversations,
    currentConversationId,
    currentMessages,
    isLoading,
    setCurrentConversationId,
    createConversation,
    deleteConversation,
    renameConversation,
  };
}
```

**3.3 Integrate useChat in ChatPage**

Update `src/components/chat/chat-page.tsx`:
```typescript
import { useChat } from '@ai-sdk/react';
import { useConversations } from '@/hooks/use-conversations';

export function ChatPage() {
  const {
    conversations,
    currentConversationId,
    currentMessages,
    createConversation,
    // ...
  } = useConversations();

  const { messages, sendMessage, status, stop } = useChat({
    id: currentConversationId || undefined,
    initialMessages: currentMessages,
    api: '/api/chat',
    body: { conversationId: currentConversationId },
  });

  const handleSend = async (content: string) => {
    if (!currentConversationId) {
      const conv = await createConversation();
      // useChat will pick up the new ID
    }
    sendMessage({ role: 'user', content });
  };

  // ... rest of component
}
```

### Phase 4: UI - Render Tool Parts

**4.1 Update message-item.tsx**

Replace content rendering with parts-based approach:
```typescript
import { UIMessage } from '@ai-sdk/react';

interface MessageItemProps {
  message: UIMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  return (
    <div className={...}>
      {message.parts.map((part, index) => {
        if (part.type === 'text') {
          return <TextContent key={index} text={part.text} />;
        }

        if (part.type.startsWith('tool-')) {
          return (
            <ToolCard
              key={index}
              toolName={part.type.replace('tool-', '')}
              state={part.state}
              input={part.input}
              output={part.output}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
```

**4.2 Create tool-card.tsx**

New component for displaying tool activity:
```typescript
import { useState } from 'react';
import { ChevronDown, ChevronUp, Wrench, CheckCircle, Loader2 } from 'lucide-react';

interface ToolCardProps {
  toolName: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  input?: Record<string, unknown>;
  output?: unknown;
}

export function ToolCard({ toolName, state, input, output }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isComplete = state === 'output-available';
  const isError = state === 'output-error';
  const isStreaming = state === 'input-streaming';

  return (
    <div className={`my-2 rounded-lg border p-3 ${
      isError ? 'border-red-200 bg-red-50' :
      isComplete ? 'border-green-200 bg-green-50' :
      'border-blue-200 bg-blue-50'
    }`}>
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        ) : isComplete ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <Wrench className="h-4 w-4 text-blue-600" />
        )}
        <span className="font-medium text-sm">{toolName}</span>
        <button onClick={() => setExpanded(!expanded)} className="ml-auto">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          {input && (
            <div>
              <div className="font-medium text-muted-foreground">Input:</div>
              <pre className="overflow-x-auto bg-white/50 p-2 rounded">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output && (
            <div>
              <div className="font-medium text-muted-foreground">Output:</div>
              <pre className="overflow-x-auto bg-white/50 p-2 rounded max-h-48">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Phase 5: Migration

**5.1 One-time localStorage migration**

Create `src/app/api/migrate/route.ts`:
```typescript
import { db } from '@/lib/db';

export async function POST(req: Request) {
  const oldData = await req.json();

  for (const conv of oldData) {
    // Insert conversation (ignore if exists)
    await db.execute({
      sql: 'INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      args: [conv.id, conv.title, conv.createdAt, conv.updatedAt],
    });

    // Insert messages (convert old format to UIMessage)
    for (let i = 0; i < conv.messages.length; i++) {
      const msg = conv.messages[i];
      const uiMessage = {
        id: msg.id,
        role: msg.role,
        status: 'ready',
        parts: [{ type: 'text', text: msg.content }],
        createdAt: new Date(msg.timestamp),
      };

      await db.execute({
        sql: 'INSERT OR IGNORE INTO messages (id, conversation_id, content, sequence_order) VALUES (?, ?, ?, ?)',
        args: [msg.id, conv.id, JSON.stringify(uiMessage), i],
      });
    }
  }

  return Response.json({ success: true });
}
```

Add migration trigger in app initialization:
```typescript
// In a client component that runs on mount
useEffect(() => {
  const stored = localStorage.getItem('notion-assistant-conversations');
  if (stored) {
    fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stored,
    }).then(() => {
      localStorage.removeItem('notion-assistant-conversations');
    });
  }
}, []);
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/db/index.ts` | CREATE | Database connection + schema init (@libsql/client) |
| `src/app/api/conversations/route.ts` | CREATE | List/create conversations |
| `src/app/api/conversations/[id]/route.ts` | CREATE | Get/update/delete conversation |
| `src/app/api/migrate/route.ts` | CREATE | One-time localStorage migration |
| `src/app/api/chat/route.ts` | MODIFY | Use toUIMessageStreamResponse |
| `src/hooks/use-chat.ts` | DELETE | Replaced by AI SDK useChat |
| `src/hooks/use-conversations.ts` | MODIFY | API-based instead of localStorage |
| `src/components/chat/chat-page.tsx` | MODIFY | Integrate useChat hook |
| `src/components/chat/message-item.tsx` | MODIFY | Render message.parts |
| `src/components/chat/tool-card.tsx` | CREATE | Tool activity display |
| `src/lib/storage.ts` | DEPRECATE | No longer needed |
| `src/lib/types.ts` | MODIFY | Update or remove old Message type |

## Dependencies

**Add:**
- `@libsql/client` - SQLite client (works with local files and Turso cloud)

---

## Testing Checklist

- [ ] Database migrations run successfully
- [ ] Can create new conversation via API
- [ ] Can list conversations via API
- [ ] Can load conversation with messages
- [ ] Chat streaming works with useChat
- [ ] Tool calls display in UI with correct states
- [ ] Tool results display after completion
- [ ] Messages persist across page reloads
- [ ] Messages persist across different browsers/devices
- [ ] localStorage migration works for existing users
- [ ] Conversation rename/delete works
