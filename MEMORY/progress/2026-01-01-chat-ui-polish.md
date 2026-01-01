# Chat UI Polish - 4 Enhancements

Last Updated: 2026-01-01

## Summary
Addressed 4 UI enhancement requests for chat interface: clickable URLs, consistent bubble styling, auto-focus after sending, and line spacing fixes for mixed CJK/Latin text.

## Changes Made

### 1. Clickable URLs with Truncation
**File**: `src/components/chat/message-item.tsx`
- Added `truncateUrl()` helper: extracts domain, shows path hint (e.g., "youtube.com/watch...")
- Modified `renderInlineFormatting()` to detect URLs via regex `/(https?:\/\/[^\s<>[\]()]+)/g`
- URLs rendered as `<a target="_blank">` with hover underline, full URL in title attribute

### 2. Chat Bubble Colors
**File**: `src/app/globals.css`
- Added missing CSS variables user/assistant bubbles were referencing
- Light mode: neutral grays (`hsl(0 0% 95%)` user, `hsl(0 0% 98%)` assistant)
- Dark mode: darker neutrals (`hsl(0 0% 22%)` user, `hsl(0 0% 18%)` assistant)
- Initially tried blue tint but user rejected as "not Notion"

### 3. Auto-Focus After Streaming
**Files**: `src/components/chat/input-area.tsx`, `src/components/chat/chat-page.tsx`
- Challenge: Can't focus disabled textarea during streaming
- Solution: Track streaming transition with `wasStreamingRef`, focus when `isStreaming` goes false
- Added 10ms setTimeout to ensure DOM update completes
- Backup trigger in `onFinish` callback

### 4. Line Spacing & Paragraph Breaks
**Files**: `src/components/chat/message-item.tsx`, `src/app/globals.css`
- Set 1.8 line-height for better CJK/Latin mixed text readability
- Changed empty line rendering from `<br>` to `<div className="h-3">` for proper paragraph spacing
- Added blockquote support (`> text`)
- Fixed copy button: changed from in-flow element to absolute position (`-bottom-1 -right-1`)

## Key Learnings
- Opacity:0 doesn't remove from layout flow - use absolute positioning for hidden-on-hover elements
- useChat `onFinish` callback fires before `isStreaming` state updates - watch state directly
- Messages stored as raw JSON in DB; all rendering happens client-side on load
