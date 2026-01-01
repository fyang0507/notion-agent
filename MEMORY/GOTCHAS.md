# GOTCHAS

## LangFuse Telemetry Issue
Langfuse observability in this app should be enabled under 2 scnarios:
1. CLI agent (src/agents/index.ts)
2. Next.js app (through instrumentation.ts)

Main issues now:
A. for CLI running, the traceID is not correctly set such that multi-turn dialogs will be logged as multiple traces.
B. the instrumentation.ts is broken, Langfuse and Vercel each offers different recipe, but neither works.

References:
- [Vercel's integration guide](https://ai-sdk.dev/providers/observability/langfuse) 
  - the tutorial uses deprecated `langfuse-vercel`
- [Langfuse's integration guide](https://langfuse.com/integrations/frameworks/vercel-ai-sdk)

## Building a Notion Skill without Notion MCP
I decided not to build with Notion MCP. Reasons:
1. complicated tools and schema, but doesn't offer even the basics of retrieving a schema from data source.
2. Notion officially exposed just 2 tools to other AI providers via connectors (fetch and search), this is not useful at all.

On the other hand, Notion API is well documented and has a good coverage of use cases.

Things are more dynamic when trying to read/write a block to a page in a data source/database. To unpack this sequentially:
0. [only once during setup] Query database/data source via search. Obtain the ID-name mapping
1. [as a prerequsit or when later step fails] check the schema (subject to change)
2. [skip if write a new page] Use filter and sort to find a page, this requires understanding of the schema
3. read/write a page/block

This naturally fits into the "Agent Skill" domain which can include some cross-session artifacts (in Notion's case, ID-name mapping, and schema manipulation guide).

## On Skill system and Agent Bash Tool
So far, Anthropic's skill layer is designed around using bash tool to access skill contents.
Bash tool however is not a universal tool offered, but provider specific. So far, only OpenAI and Anthropic has built-in bash tool support. Otherwise, we need to use custom-made sandbox, or fallback to tool use.
Notion agent chooses to use OpenAI/gpt-5.2 with built-in support to simplify the tech stack, albeit incurring more costs.

## AI SDK useChat Message Sync
The `useChat` hook's `messages` parameter is only used as **initial messages** when the hook first mounts or when the `id` changes. It does NOT reactively update when the prop changes.

When switching conversations with async message loading:
1. `currentConversationId` changes → triggers hook reinitialization
2. Messages are fetched asynchronously via `useEffect`
3. By the time messages arrive, `useChat` has already initialized with empty/stale messages

**Fix:** Use `setMessages` from `useChat` to manually sync:
```tsx
const { messages, setMessages } = useChat({ id: currentConversationId });

useEffect(() => {
  setMessages(currentMessages);  // Sync when API fetch completes
}, [currentMessages, setMessages]);
```

## Agent tool-detection patterns
With notion operations fold into a skill-based system, it's time to consider two different agent patterns moving forward:
1. keep non-notion operations as native tools
2. migrate all tool usage into skill-based pattern
Theoretically, Option 1 is easier to implement in the SDK, has better SDK (for example, explicit human approval control) and observability support; Option 2 is more robust to the explosion of tools once future tool-based capabilities are added thanks to progressive disclosure, and it also brings design parity with the notion tools.
A more detailed comparison of agent pattern is recorded in MEMORY/plan/2025-12-29-agent-design-patterns.md
We should evaluate both patterns once new tools are developed.