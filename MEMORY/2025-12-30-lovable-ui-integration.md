# Lovable UI Integration into Next.js

Last Updated: 2025-12-30

## Summary
Successfully merged Lovable-generated Vite+React chat UI into existing Next.js project with App Router. Adapted demo implementations to connect with real backend APIs (`/api/chat` and `/api/transcribe`).

## Architecture Changes

### Frontend Stack Added
- **Framework**: Next.js 16.1.1 with App Router
- **UI Library**: shadcn/ui (40+ Radix UI components)
- **Styling**: Tailwind CSS 4.1.18 with CSS variables
- **State Management**: React hooks with localStorage persistence
- **Theme**: next-themes for dark/light mode

### Key Files Created

**App Structure:**
- `src/app/page.tsx` - Main chat page (client component)
- `src/app/layout.tsx` - Root layout with providers (ThemeProvider, TooltipProvider, Toaster)
- `src/app/globals.css` - Tailwind config with CSS variables for theming
- `src/app/api/chat/route.ts` - Streaming chat API endpoint (53 lines)

**Chat Components** (`src/components/chat/`):
- `chat-page.tsx` - Main layout orchestrating sidebar, messages, and input
- `sidebar.tsx` - Conversation history with grouped display (Today, Yesterday, etc.)
- `message-list.tsx` & `message-item.tsx` - Message rendering with markdown support
- `input-area.tsx` - Chat input with auto-expand textarea and voice button
- `voice-recorder.tsx` - Voice recording UI with status indicators

**State Hooks** (`src/hooks/`):
- `use-chat.ts` - Manages streaming chat with AbortController for stop generation
- `use-conversations.ts` - localStorage CRUD for conversation history with auto-titling
- `use-voice-recorder.ts` - MediaRecorder API integration calling `/api/transcribe`
- `use-theme.ts` - Wrapper for next-themes with toggle functionality
- `use-mobile.tsx` - Responsive breakpoint detection
- `use-toast.ts` - Toast notification system

**Utilities** (`src/lib/`):
- `types.ts` - TypeScript interfaces (Message, Conversation, ConversationGroup)
- `storage.ts` - localStorage helpers (load/save conversations, ID generation, title generation)
- `utils.ts` - `cn()` utility for className merging (clsx + tailwind-merge)

### Backend Integration

**Web Agent Factory** (`src/agents/web-agent.ts`, 96 lines):
- Extracted from CLI agent to support HTTP requests
- Creates unified agent with same tools (shell, search_datasource, create_page)
- Returns streamable agent instance for API routes

**API Routes:**
- `/api/chat` - POST endpoint accepting messages array, returns streaming text response
- `/api/transcribe` - Existing endpoint for Whisper STT (Groq API)

### Hook Adaptations (Demo → Production)

**use-chat.ts Changes:**
- Removed demo response simulation with hardcoded strings
- Added real `/api/chat` fetch with ReadableStream handling
- Implemented AbortController for stop generation functionality
- Added messages array to hook params for full conversation context

**use-voice-recorder.ts Changes:**
- Removed demo transcription with random text selection
- Added real `/api/transcribe` POST with FormData (audio blob)
- Handles actual API response parsing for transcribed text

### Dependencies Added (57 new packages)

**Core:**
- next@16.1.1, react@19.2.3, react-dom@19.2.3
- next-themes@0.3.0 for theme management
- sonner@1.7.4 for toast notifications

**UI Libraries:**
- 18 @radix-ui/* components (accordion, alert-dialog, avatar, checkbox, etc.)
- lucide-react@0.562.0 for icons
- class-variance-authority, clsx, tailwind-merge for styling utilities

**Form/Input:**
- react-hook-form@7.69.0, input-otp@1.4.2
- react-day-picker@9.13.0 for calendar
- embla-carousel-react@8.6.0 for carousels

**Additional:**
- recharts@3.6.0, cmdk@1.1.1, vaul@1.1.2
- react-resizable-panels@4.1.0

### Configuration Files Created

- `next.config.mjs` - Next.js config with experimental instrumentation hook
- `tailwind.config.ts` - Tailwind 4.x config with CSS variables
- `postcss.config.mjs` - PostCSS config for Tailwind processing
- `components.json` - shadcn/ui configuration
- `vercel.json` - Function timeout config (60s for Pro tier)

## Implementation Details

### Conversation Management
- Uses localStorage key: `notion-assistant-conversations`
- Auto-generates titles from first user message (40 char limit with ellipsis)
- Groups conversations by date: Today, Yesterday, Last 7 Days, Last 30 Days, Older
- Maintains conversation order by `updatedAt` timestamp

### Streaming Chat Flow
1. User sends message → `use-chat.sendMessage()`
2. Adds user message and empty assistant message to conversation
3. POST to `/api/chat` with full message history
4. Backend creates agent → `agent.stream({ messages })`
5. ReadableStream chunks decoded and accumulated
6. Updates last message content in real-time via `onUpdateLastMessage()`
7. AbortController allows stopping mid-stream

### Voice Recording Flow
1. User clicks mic → `use-voice-recorder.startRecording()`
2. MediaRecorder starts with `audio/webm` or `audio/mp4` (browser fallback)
3. Records in 100ms chunks, tracks duration with timer
4. User stops → chunks combined into Blob → POST to `/api/transcribe`
5. Transcribed text returned → calls `onTranscription(text)`
6. Input area receives text and auto-populates textarea

### Theme System
- Uses CSS variables defined in `globals.css` for light/dark mode
- `next-themes` manages theme state in localStorage
- ThemeProvider in layout handles SSR hydration correctly
- Custom `use-theme` hook wraps next-themes for easier usage

## Technical Decisions

**Why Next.js over Vite?**
- Existing backend already used Next.js API routes
- Better integration with Vercel deployment
- Built-in API routes avoided separate backend server

**Why localStorage over Database?**
- Single-user design per plan
- No auth required for MVP
- Instant load with no backend dependency
- Can migrate to database later if needed

**Why shadcn/ui over Component Library?**
- Full ownership of components (copied into codebase)
- Customizable without library version constraints
- Tailwind-based for consistent styling
- Radix UI primitives for accessibility

## Known Issues

### TypeScript Errors (Non-blocking)
- Some shadcn components have type errors in: `calendar.tsx`, `chart.tsx`, `resizable.tsx`
- Caused by version mismatches (react-day-picker@9.x, recharts@3.x, react-resizable-panels@4.x)
- Does not affect runtime functionality
- Can be fixed with `@ts-ignore` or component updates

### Next-themes Peer Dependency Warning
- next-themes@0.3.0 expects React 16-18, project uses React 19
- Non-breaking, functionality works correctly
- Waiting for next-themes@0.4.x for React 19 support

## Testing Checklist

- [x] App renders without crashes
- [x] Sidebar shows/hides correctly
- [x] Dark/light mode toggle works
- [x] New conversation creates empty conversation
- [ ] Send message streams response from agent
- [ ] Stop generation button aborts streaming
- [ ] Voice recording captures audio
- [ ] Transcription returns text from Whisper API
- [ ] Conversation history persists on reload
- [ ] Mobile responsive layout works
- [ ] Markdown rendering in messages displays correctly

## Next Steps

1. **Test Production APIs**: Verify `/api/chat` streaming with real agent queries
2. **Test Voice Input**: Confirm microphone permissions and transcription accuracy
3. **Deploy to Vercel**: Set environment variables (OPENAI_API_KEY, GROQ_API_KEY, NOTION_API_KEY)
4. **Fix TypeScript**: Add type fixes or suppressions for clean build
5. **Performance**: Monitor Vercel function timeouts (60s limit on Pro tier)
6. **Observability**: Ensure Langfuse telemetry captures frontend-initiated requests

## Files Modified (Existing)
- `package.json` - Added frontend dependencies and Next.js scripts
- `tsconfig.json` - Added Next.js paths and JSX config
- Minor type fixes in skill files (imports)
