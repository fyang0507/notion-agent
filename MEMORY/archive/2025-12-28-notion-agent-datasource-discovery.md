# Notion Agent: Database Discovery & Cataloging

Last Updated: 2025-12-28

## Summary
Initial implementation of a Notion agent focused on discovering and cataloging Notion databases. The agent extracts database schemas using LLM and caches them locally for future query operations.

## Architecture Decisions

### Why Not Notion MCP
- Notion MCP tools are overly complex without providing basic schema retrieval
- Official Notion connectors only expose 2 limited tools (fetch/search)
- Direct Notion API usage provides better control and documentation

### Workflow Design
1. Search databases via Notion API search endpoint
2. Extract schema metadata using LLM (deepseek-v3.2)
3. Cache in TOML format for reuse across sessions
4. Future: Use cached schema to build query filters

## Implementation Details

### Files Created
- `src/agents/notion-agent/index.ts` - Main agent with Gemini 3 Flash
- `src/agents/notion-agent/tools/search-datasource.ts` - Search & save tools
- `src/agents/notion-agent/utils/datasource-toml.ts` - TOML cache management
- `scripts/search-notion-database.ts` - Debug/test script

### Key Patterns
- **LLM Schema Extraction**: Uses `generateText` with structured output to parse Notion's raw database response into clean property metadata
- **Cache-First Strategy**: `checkCachedDatasource()` checks local TOML before API call
- **Auto-Save on Single Match**: When search returns one database, automatically saves metadata

### Data Storage
Location: `AGENT_WORKING_FOLDER/notion_datasources.toml`
```toml
[[datasources]]
name = "Database Name"
id = "notion-db-id"
[datasources.properties.PropertyName]
type = "status"
options = ["Todo", "In Progress", "Done"]
```

## Next Steps
- Implement query/filter tools using cached schema
- Add page creation and update capabilities
- Build block-level read/write operations
