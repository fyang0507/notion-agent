# Plan: Unified Agent with Gateway Pattern

## Summary
Merge podcast-agent into notion-agent as a unified agent with two command domains:
- `notion *` - Notion database operations (renamed from `skill`)
- `podcast *` - Podcast discovery and management (new)

## Final Structure

```
src/agents/
├── agent/
│   ├── index.ts                    # Unified agent entry point
│   └── utils/
│       └── shell-executor.ts       # Async command routing
└── skills/
    ├── notion/
    │   ├── index.ts                # createNotionCommands()
    │   ├── tools/                  # Notion API tools
    │   │   ├── search-datasource.ts
    │   │   └── create-page.ts
    │   └── utils/
    │       └── datasource-store.ts
    └── podcast/
        ├── index.ts                # createPodcastCommands()
        ├── tools/                  # Podcast tools
        │   ├── podcast-search.ts
        │   ├── save-podcast.ts
        │   ├── check-duplicate.ts
        │   └── recommend-episodes.ts
        └── utils/
            ├── toml-reader.ts
            ├── toml-writer.ts
            ├── rss-fetcher.ts
            └── episode-recommender.ts
```

### Folders to Delete
- `src/agents/notion-agent/` - migrated to agent/ + skills/notion/
- `src/agents/podcast-agent/` - migrated to skills/podcast/

## Implementation Steps

### Step 1: Create podcast commands wrapper
Create `src/agents/skills/podcast/index.ts`:

```typescript
// Wrap existing podcast tools as shell commands
export function createPodcastCommands(): Record<string, (args: string) => Promise<string> | string> {
  return {
    'podcast help': () => `Available commands:
  podcast list               - List saved podcasts
  podcast search <query>     - Search iTunes for podcasts
  podcast save <name> <url>  - Save a podcast to local storage
  podcast check <name>       - Check if podcast already saved
  podcast recommend [opts]   - Get episode recommendations`,

    'podcast list': () => { /* read from podcasts.toml */ },
    'podcast search': async (query) => { /* wrap podcastSearch */ },
    'podcast save': async (args) => { /* wrap savePodcast */ },
    'podcast check': async (name) => { /* wrap checkDuplicate */ },
    'podcast recommend': async (args) => { /* wrap recommendEpisodes */ },
  };
}
```

### Step 2: Rename skill commands to notion prefix
In `src/agents/skills/notion/index.ts`, rename all command prefixes:

| Old Command | New Command |
|-------------|-------------|
| `skill list` | `notion list` |
| `skill read` | `notion read` |
| `skill check` | `notion check` |
| `skill help` | `notion help` |
| `skill draft` | `notion draft` |
| `skill show-draft` | `notion show-draft` |
| `skill commit` | `notion commit` |
| `skill discard` | `notion discard` |

Also rename `createSkillCommands` → `createNotionCommands` and update help text.

### Step 3: Update shell executor for async
Current `shell-executor.ts` returns sync strings. Update to support async handlers:

```typescript
export type CommandHandler = (args: string) => string | Promise<string>;

export function createCommandExecutor(
  commands: Record<string, CommandHandler>
): (command: string) => Promise<string>
```

### Step 4: Update unified agent
In `src/agents/agent/index.ts`:

```typescript
import { createPodcastCommands } from '../skills/podcast/index.js';
import { createNotionCommands } from '../skills/notion/index.js';

const executeCommand = createCommandExecutor({
  ...createNotionCommands(),
  ...createPodcastCommands(),
});

// Update instructions to include both domains
const instructions = `
## Available Domains
- notion help   - Notion database operations
- podcast help  - Podcast discovery and management
`;
```

### Step 5: Update shell tool executor for async
The `shell` tool's `execute` function needs to handle async command handlers:

```typescript
shell: openai.tools.shell({
  execute: async ({ action }) => {
    const results = await Promise.all(
      action.commands.map(async (command: string) => {
        const output = await executeCommand(command);
        // ...rest unchanged
      })
    );
    return { output: results };
  },
}),
```

## Command Mapping

| Old Tool | New Command | Notes |
|----------|-------------|-------|
| (new) | `podcast list` | Read from podcasts.toml |
| `podcast_search` | `podcast search <query>` | Query passed as string |
| `save_podcast` | `podcast save <name> <url>` | Parse two args |
| `check_duplicate` | `podcast check <name>` | Single arg |
| `recommend_episodes` | `podcast recommend [topN] [days] [criteria]` | Optional args |

## Migration Steps

### Step 6: Migrate and consolidate folders
1. Create `src/agents/agent/` with index.ts and utils/shell-executor.ts
2. Create `src/agents/skills/notion/` - move notion tools, utils, and skills from notion-agent
3. Create `src/agents/skills/podcast/` - move podcast tools, utils from podcast-agent
4. Delete `src/agents/notion-agent/` folder
5. Delete `src/agents/podcast-agent/` folder
