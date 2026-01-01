# Agent Design Patterns: Single Agent vs Subagents

## When Subagents Make Sense

Subagent architecture solves specific problems:

| Problem | Subagent Solution |
|---------|-------------------|
| **Context bloat** | Offload verbose intermediate work (e.g., codebase exploration) |
| **Async parallelism** | Spin off independent research branches |
| **Model specialization** | Different models excel at different subtasks |
| **Deep research** | Long-running tasks that produce concise summaries |

The key pattern: subagent does extensive work, returns **concise response** that doesn't bloat main agent context.

## When Single Agent Suffices

If your use case has:
- Synchronous, linear conversations
- Tools that return reasonably-sized responses
- No need for parallel deep-dive research
- Single model handles all tasks adequately

Then subagents add complexity without benefit.

## Single Agent with Progressive Disclosure

### Challenge
How do 20+ tools from multiple domains coexist without overwhelming the agent?

### Strategy 1: Namespaced Tools
```
podcast_search, podcast_get_details, podcast_get_transcript
youtube_search, youtube_get_details, youtube_get_transcript
notion_query, notion_create, notion_update
```
Agent learns domain boundaries from prefixes. Simple, explicit, extensible.

### Strategy 2: Meta-Tool Pattern
```typescript
content_search({
  source: 'podcast' | 'youtube',
  query: string
})
```
Reduces tool count but hides capabilities. Better for very large tool sets.

### Strategy 3: Instruction-Driven Routing
System prompt encodes when to use which domain:
```markdown
When user mentions podcasts, shows, episodes → use podcast_* tools
When user mentions videos, youtube → use youtube_* tools
When user says "save", "remember" → use notion_* tools
```

### Strategy 4: Gateway Pattern (Recommended)

Instead of loading all tool schemas into context, expose a single shell tool and let domains register command handlers. Agent discovers capabilities on-demand via `<domain> help`.

**Context comparison:**

```
NATIVE TOOLS (all in context)
┌─────────────────────────────────────────────┐
│ podcast_search: { description, schema }     │  ← ~200 tokens
│ podcast_get_episodes: { ... }               │  ← ~150 tokens
│ podcast_get_transcript: { ... }             │  ← ~150 tokens
│ recommend_episodes: { ... }                 │  ← ~200 tokens
│ youtube_search: { ... }                     │  ← ~200 tokens
│ ... (20+ tools = 3000+ tokens)              │
└─────────────────────────────────────────────┘

GATEWAY PATTERN (on-demand)
┌─────────────────────────────────────────────┐
│ shell: { execute commands }                 │  ← ~100 tokens
│                                             │
│ Instructions: "Available domains:           │
│   podcast help, youtube help, skill help"   │  ← ~50 tokens
└─────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// Each domain exports a command creator
// podcast-agent/commands.ts
export function createPodcastCommands(): Record<string, (args: string) => Promise<string>> {
  return {
    'podcast help': () => `
Available commands:
  podcast search <query>      - Search for podcasts
  podcast episodes <id>       - Get episodes for a podcast
  podcast transcript <id>     - Get episode transcript
  podcast recommend <topic>   - Get AI recommendations
`,
    'podcast search': async (query) => {
      // Reuse existing tool implementation
      const result = await podcastSearch.execute({ query });
      return JSON.stringify(result, null, 2);
    },
    // ... wrap other existing tools
  };
}

// Unified agent composes all domain commands
const executeCommand = createCommandExecutor({
  ...createPodcastCommands(),
  ...createYoutubeCommands(),
  ...createSkillCommands(),  // notion skills
});
```

**Agent workflow:**
1. User: "Find me a podcast about machine learning"
2. Agent runs: `podcast help` → sees available commands
3. Agent runs: `podcast search "machine learning"` → gets results
4. Agent runs: `skill help` → sees Notion save options
5. Agent runs: `skill read save-podcast` → gets save instructions

**Benefits:**
- Context window stays lean regardless of tool count
- Consistent `<domain> help` discovery pattern across all domains
- Existing tool implementations unchanged (just wrapped)
- New domain = new command set, same shell interface

## The Funnel Pattern

For information intake applications:

```
┌─────────────────────────────────────────┐
│  DISCOVERY LAYER (upper funnel)         │
│  Sources: podcast, youtube, rss, etc.   │
│  Purpose: Find and curate content       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  STORAGE LAYER (lower funnel)           │
│  Sink: Notion (universal destination)   │
│  Purpose: Human-agent handoff point     │
└─────────────────────────────────────────┘
```

### Key Insight
The sink (Notion) is asymmetric - it's not just another tool domain. All sources eventually flow into it. Design should reflect this:

- **Source tools**: Interchangeable, user wants "content about X"
- **Sink tools**: Consistent destination for persistence
- **Agent role**: Bridge discovery to storage based on user intent

## Adding New Domains

With the gateway pattern, adding a new source is straightforward:

1. Create tool implementations (standard Vercel AI SDK `tool()`)
2. Wrap tools in `createNewdomainCommands()` command handler
3. Register commands in unified `createCommandExecutor()`
4. Add `newdomain help` to agent instructions

```typescript
// Step 1-2: Create commands wrapper
export function createYoutubeCommands() {
  return {
    'youtube help': () => `...available commands...`,
    'youtube search': async (query) => youtubeSearch.execute({ query }),
    'youtube transcript': async (id) => youtubeTranscript.execute({ id }),
  };
}

// Step 3: Register in unified executor
const executeCommand = createCommandExecutor({
  ...createPodcastCommands(),
  ...createYoutubeCommands(),  // ← add here
  ...createSkillCommands(),
});

// Step 4: Update instructions
const instructions = `
Available domains:
- podcast help  - Podcast discovery
- youtube help  - YouTube discovery  ← add here
- skill help    - Notion operations
`;
```

No new agents, no routing logic changes, no inter-agent protocols.

## Trade-offs Summary

| Aspect | Subagent | Native Tools | Gateway Pattern |
|--------|----------|--------------|-----------------|
| Context efficiency | Best (offloads work) | Poor (all schemas loaded) | Good (on-demand discovery) |
| Implementation complexity | High (protocols) | Low (direct) | Medium (command wrappers) |
| Model flexibility | Can mix models | One model | One model |
| Debugging | Hard (distributed) | Easy (direct) | Easy (single flow) |
| Extensibility | Add new agent | Add tools + redeploy | Add commands + register |
| Tool count scaling | N/A | Degrades with count | Stays lean |

**Recommendation**: Use gateway pattern for single-agent architectures with 10+ tools across multiple domains. Reserve subagents for async deep-research workloads.
