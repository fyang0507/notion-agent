# Frontend Development Plan: Chat UI + Backend Routing

## Overview

Build a Claude/GPT-like chat UI for the Notion agent with:
- Conversation history sidebar
- Voice mode (dictation)
- Streaming text chat
- Single-user (localStorage persistence)
- Vercel hosting

**Approach**: Generate base UI with v0.dev → customize with shadcn/ui → integrate with existing agent backend

---

## Phase 1: Project Setup

### 1.1 Install Dependencies

```bash
pnpm add next react react-dom
pnpm add @radix-ui/react-scroll-area @radix-ui/react-dialog @radix-ui/react-dropdown-menu
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add react-markdown remark-gfm uuid
pnpm add -D tailwindcss postcss autoprefixer @types/react @types/react-dom @types/uuid
```

### 1.2 Configuration Files to Create

| File | Purpose |
|------|---------|
| `next.config.mjs` | Next.js App Router config |
| `tailwind.config.ts` | Tailwind + shadcn preset |
| `postcss.config.mjs` | PostCSS for Tailwind |
| `src/app/globals.css` | Tailwind directives |
| `src/lib/utils.ts` | `cn()` utility |
| `components.json` | shadcn/ui config |

### 1.3 Initialize shadcn/ui

```bash
npx shadcn@latest init
npx shadcn@latest add button input scroll-area dialog dropdown-menu tooltip
```

### 1.4 Update tsconfig.json

Add Next.js-specific config:
- `"jsx": "preserve"`
- `"paths": { "@/*": ["./src/*"] }`
- Include `next-env.d.ts`

---

## Phase 2: Backend API Route

### 2.1 Create Web Agent Factory

**File**: `src/agents/web-agent.ts`

Extract agent creation from `src/agents/index.ts` into a reusable factory:
- Export `createUnifiedAgent()` function (no CLI readline loop)
- Share same tools: `shell`, `search_datasource`, `create_page`
- **Keep `src/agents/index.ts` CLI intact** for debugging/testing

### 2.2 Create Chat API Route

**File**: `src/app/api/chat/route.ts`

```typescript
// POST /api/chat
// Body: { messages: Array<{role, content}> }
// Returns: Streaming text response
```

- Accept messages array from frontend
- Create agent instance
- Stream `textStream` back to client
- Support AbortController for stop generation

---

## Phase 3: v0.dev UI Generation (Outside Claude Code)

> **Note**: This phase is done manually in browser at [v0.dev](https://v0.dev)

### 3.1 Prompts for v0.dev

**Main Layout**:
> Create a Claude-like chat interface with collapsible conversation history sidebar, main chat area with message list, dark/light mode toggle, mobile responsive. Use shadcn/ui, Tailwind, TypeScript.

**Input Area**:
> Chat input with multi-line textarea, voice recording button (mic icon), send button, stop generation button. Enter to send, Shift+Enter newline.

**Sidebar**:
> Conversation history sidebar with new chat button, conversation list with title/date, hover actions (rename/delete), grouped by date.

### 3.2 Export and Customize

1. Generate each component in v0.dev (browser)
2. Export via "Add to Codebase"
3. Copy generated code into project
4. Customize styling and behavior

---

## Phase 4: Frontend Architecture

### 4.1 File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts         # NEW: Chat endpoint
│   │   └── transcribe/route.ts   # Existing
│   ├── layout.tsx                # NEW: Root layout
│   ├── page.tsx                  # NEW: Chat page
│   └── globals.css               # NEW: Styles
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   └── chat/
│       ├── chat-page.tsx
│       ├── sidebar.tsx
│       ├── message-list.tsx
│       ├── message-item.tsx
│       ├── input-area.tsx
│       └── voice-recorder.tsx
├── hooks/
│   ├── use-chat.ts               # Chat state + streaming
│   ├── use-conversations.ts      # localStorage CRUD
│   └── use-voice-recorder.ts     # MediaRecorder API
├── lib/
│   ├── utils.ts
│   ├── storage.ts
│   └── types.ts
└── agents/
    ├── index.ts                  # CLI agent (keep for debugging/testing)
    └── web-agent.ts              # NEW: Web factory (shares agent config)
```

### 4.2 Core Hooks

**use-chat.ts**: Manage messages, streaming state, send/stop functions
**use-conversations.ts**: localStorage persistence, CRUD operations
**use-voice-recorder.ts**: MediaRecorder → /api/transcribe → text callback

---

## Phase 5: Voice Input

### 5.1 Voice Recorder Hook

- Use MediaRecorder API with `audio/webm;codecs=opus`
- On stop: send blob to `/api/transcribe`
- Return transcribed text via callback
- Handle recording/transcribing states

### 5.2 Voice UI Component

- Mic button with recording animation
- Loading state during transcription
- Disable when streaming response

---

## Phase 6: Vercel Deployment

### 6.1 Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Agent model |
| `GROQ_API_KEY` | Whisper STT |
| `NOTION_API_KEY` | Notion ops |
| `LANGFUSE_*` | Telemetry (optional) |

### 6.2 Configuration

**vercel.json**:
```json
{
  "functions": {
    "src/app/api/chat/route.ts": { "maxDuration": 60 }
  }
}
```

**next.config.mjs**:
```javascript
const nextConfig = {
  experimental: { instrumentationHook: true },
  serverExternalPackages: ['@notionhq/client'],
};
```

### 6.3 Pricing

| Tier | Function Duration | Recommendation |
|------|-------------------|----------------|
| Hobby (Free) | 10s | Not sufficient |
| **Pro ($20/mo)** | 60s | **Minimum recommended** |
| Enterprise | 900s | For complex operations |

### 6.4 Telemetry Setup

**File**: `src/instrumentation.ts`
- Initialize LangfuseSpanProcessor for production
- Only runs in Node.js runtime

---

## Implementation Order

| Step | Task |
|------|------|
| 1 | Add dependencies (Next.js, React, Tailwind, shadcn) |
| 2 | Create config files (next.config, tailwind.config, etc.) |
| 3 | Initialize shadcn/ui and add components |
| 4 | Create `src/agents/web-agent.ts` |
| 5 | Create `/api/chat/route.ts` |
| 6 | Create hooks (use-chat, use-conversations, use-voice-recorder) |
| 7 | Generate UI from v0.dev and import (outside Claude Code) |
| 8 | Create chat components and wire up |
| 9 | Create layout.tsx and page.tsx |
| 10 | Create instrumentation.ts and vercel.json |
| 11 | Test locally with `pnpm dev` |
| 12 | Deploy to Vercel |

---

## Critical Files

| File | Action |
|------|--------|
| `src/agents/index.ts` | Keep as CLI, reference for web-agent.ts |
| `src/agents/web-agent.ts` | NEW: Web factory sharing agent config |
| `src/app/api/transcribe/route.ts` | Pattern for API routes |
| `src/agents/utils/shell-executor.ts` | Import into web-agent |
| `package.json` | Add frontend dependencies |
| `tsconfig.json` | Update for Next.js |

---

## Notes

- **localStorage limitation**: Conversations don't sync across devices (single-user design)
- **Browser compatibility**: Check MediaRecorder API before enabling voice
- **Function timeout**: Pro tier (60s) recommended for agent tool loops
