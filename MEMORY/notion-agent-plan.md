# Notion Agent Implementation Plan

## Overview
Build a CLI-based Notion agent using **MCP-first approach** with Vercel AI SDK's `@ai-sdk/mcp` package. Connects to official `@notionhq/notion-mcp-server` via stdio transport, with a custom schema caching layer.

**Why MCP over direct SDK:**
- `notion-search` capability out-of-the-box (complex to build ourselves)
- 21 tools maintained by Notion team
- Future API updates handled automatically

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Notion Agent                         │
│  ┌───────────────┐    ┌──────────────────────────────┐ │
│  │ Custom Tools  │    │  MCP Tools (via @ai-sdk/mcp) │ │
│  │               │    │                              │ │
│  │ save_schema   │    │ notion-search                │ │
│  │ load_schema   │    │ notion-fetch                 │ │
│  │               │    │ notion-create-pages          │ │
│  └───────┬───────┘    │ notion-query-data-sources    │ │
│          │            │ notion-get-self              │ │
│          ▼            └──────────────┬───────────────┘ │
│  ┌───────────────┐                   │                 │
│  │ TOML Storage  │                   ▼                 │
│  │ (schemas)     │    ┌──────────────────────────────┐ │
│  └───────────────┘    │ notion-mcp-server (stdio)    │ │
│                       └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## File Structure
```
src/agents/notion-agent/
  index.ts                    # Entry point with ToolLoopAgent + MCP client
  tools/
    save-schema.ts            # Custom: persist schema to TOML
    load-schema.ts            # Custom: read cached schema
  utils/
    mcp-client.ts             # MCP client setup for notion-mcp-server
    schema-storage.ts         # TOML read/write + inline types

scripts/
  test-mcp-connection.ts      # Test MCP connection + notion-get-self
  test-notion-search.ts       # Test notion-search with a query
  test-notion-fetch.ts        # Test notion-fetch to get database schema
  test-notion-query.ts        # Test notion-query-data-sources with filters
  test-notion-create.ts       # Test notion-create-pages
```

## Tool Mapping (Actual MCP Tools)

| MCP Tool | Purpose |
|----------|---------|
| `API-post-search` | Search workspace for pages/databases by title |
| `API-retrieve-a-data-source` | Get database schema + properties |
| `API-query-data-source` | Query database with filters |
| `API-post-page` | Create new page in database |
| `API-patch-page` | Update page properties |
| `API-get-self` | Health check / verify connection |
| `API-retrieve-a-page` | Get page content |
| `API-get-block-children` | Get child blocks |
| `API-patch-block-children` | Append blocks to page |
| `save_schema` | Custom: Cache database schema to TOML |
| `load_schema` | Custom: Load cached schema from TOML |

## MCP Client Setup

Using `@ai-sdk/mcp` with stdio transport:

```typescript
import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { spawn } from 'child_process';

const mcpClient = await experimental_createMCPClient({
  transport: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    env: { NOTION_TOKEN: process.env.NOTION_TOKEN },
  },
});

// Get tools from MCP server
const mcpTools = await mcpClient.tools();
```

## Schema Caching Strategy
- Store in `AGENT_WORKING_FOLDER/notion-schemas.toml`
- Cache database schemas after `notion-fetch` returns them
- Agent instructions guide when to cache (new database interaction)
- Schema includes: database_id, name, last_fetched, properties[]

## Implementation Steps

### Step 1: Setup & Dependencies
- [x] Add `@ai-sdk/mcp` dependency
- [x] Add `@notionhq/notion-mcp-server` as dev dependency (for npx caching)
- [x] Create directory structure

### Step 2: MCP Client + Test
- [x] Create `utils/mcp-client.ts` - initialize MCP connection
- [x] Create `scripts/test-mcp-connection.ts` - verify MCP + API-get-self works

### Step 3: Schema Storage (Custom Tools)
- [x] Create `utils/schema-storage.ts` - TOML read/write with inline types
- [x] Create `tools/save-schema.ts` - persist schema tool
- [x] Create `tools/load-schema.ts` - read cached schema tool

### Step 4: Agent Entry Point
- [x] Create `index.ts`:
  - Initialize MCP client
  - Combine MCP tools + custom tools
  - Setup ToolLoopAgent with combined toolset
  - CLI interaction loop
  - Telemetry via Langfuse

### Step 5: Agent Instructions
- [x] Write system prompt that guides:
  - Use `API-get-self` first to verify connection
  - Use `API-post-search` to find databases by name
  - Use `API-retrieve-a-data-source` to learn schema, then `save_schema` to cache
  - Use `load_schema` before writes to validate properties
  - Use `API-query-data-source`/`API-post-page` for CRUD

### Step 6: Test Scripts for MCP Tools
- [ ] Create `scripts/test-notion-search.ts` - search workspace by query
- [ ] Create `scripts/test-notion-fetch.ts` - fetch database/page by URL
- [ ] Create `scripts/test-notion-query.ts` - query database with filters
- [ ] Create `scripts/test-notion-create.ts` - create page in database

### Step 7: Integration
- [x] Add npm script: `"notion-agent": "tsx src/agents/notion-agent/index.ts"`
- [ ] End-to-end test with real Notion database

## Key Files to Reference
- [index.ts](../src/agents/podcast-agent/index.ts) - ToolLoopAgent pattern
- [toml-writer.ts](../src/agents/podcast-agent/utils/toml-writer.ts) - TOML persistence
- [toml-reader.ts](../src/agents/podcast-agent/utils/toml-reader.ts) - TOML reading

## Dependencies
```json
{
  "dependencies": {
    "@ai-sdk/mcp": "^1.0.0"
  },
  "devDependencies": {
    "@notionhq/notion-mcp-server": "^2.0.0"
  }
}
```

## Environment
```
NOTION_TOKEN=secret_xxx...  # User already has this
```

## Sources
- [AI SDK MCP Integration](https://vercel.com/blog/ai-sdk-4-2)
- [Notion MCP Server](https://github.com/makenotion/notion-mcp-server)
- [Notion MCP Tools](https://developers.notion.com/docs/mcp-supported-tools)
