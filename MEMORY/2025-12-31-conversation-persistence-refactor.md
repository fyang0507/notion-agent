# Conversation Persistence Refactor

Last Updated: 2025-12-31

## Overview
Migrated conversation storage from browser localStorage to server-side SQLite, enabling proper message persistence with full LLM trace (including tool calls/results).

## Architecture

### Database Layer (`src/lib/db/index.ts`)
- Uses `@libsql/client` - works locally with file:// and in production with Turso cloud
- Schema: `conversations` (id, title, created_at, updated_at) and `messages` (id, conversation_id, content, sequence_order)
- Content stored as JSON-serialized UIMessage with full parts array

### API Routes
- `GET/POST /api/conversations` - List all, create new
- `GET/PATCH/DELETE /api/conversations/[id]` - Single conversation CRUD
- `POST /api/migrate` - One-time localStorage migration
- `POST /api/chat` - Refactored to use `toUIMessageStreamResponse()` with `onFinish` persistence

### Frontend Integration
- `useConversations` hook fetches from API instead of localStorage
- `useChat` from `@ai-sdk/react` replaces custom hook (deleted `use-chat.ts`)
- `setMessages` sync in `useEffect` ensures messages load when switching conversations
- `DefaultChatTransport` passes conversationId in request body

## Key Patterns

### AI SDK Message Persistence (from docs)
```typescript
return result.toUIMessageStreamResponse({
  originalMessages: inputMessages,
  onFinish: async ({ messages }) => {
    // Persist messages to database
  },
});
```

### Conversation Switching Fix
```typescript
// useChat's messages prop is only initial - must sync manually
useEffect(() => {
  setMessages(currentMessages);
}, [currentMessages, setMessages]);
```

## Files Changed
- Created: `src/lib/db/index.ts`, `src/app/api/conversations/`, `src/app/api/migrate/`, `src/components/chat/tool-card.tsx`
- Modified: `src/app/api/chat/route.ts`, `src/components/chat/chat-page.tsx`, `src/hooks/use-conversations.ts`, `src/components/chat/message-item.tsx`
- Deleted: `src/hooks/use-chat.ts`, `src/agents/web-agent.ts`

## Dependencies Added
- `@libsql/client` - SQLite client
- `@ai-sdk/react` - React hooks for AI SDK
