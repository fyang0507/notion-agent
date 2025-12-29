# Create Page Tool Implementation

Last Updated: 2025-12-28

## Summary

Added page creation capability to notion-agent, allowing users to create new pages in Notion databases with properties passed directly in Notion API format.

## Changes Made

### New Tool: `create_page` ([create-page.ts](src/agents/notion-agent/tools/create-page.ts))
- Accepts `datasourceName`, `properties`, and optional `children` blocks
- Looks up datasource from local TOML cache by name (case-insensitive)
- Passes properties directly to Notion API without transformation
- Returns page ID and URL on success, error message on failure

### Refactored: `search_datasource` ([search-datasource.ts](src/agents/notion-agent/tools/search-datasource.ts))
- Removed `autoSave` parameter (was default true)
- Added `forceRefresh` parameter to bypass cache when schema becomes stale
- Now auto-saves ALL matches (previously only single match)
- Simplified workflow: search → auto-cache → use cached data

### Removed: `save_datasource` tool
- Functionality merged into search workflow (auto-save all matches)
- Reduces tool complexity for the agent

### Updated Agent Instructions ([index.ts](src/agents/notion-agent/index.ts))
- Added page creation workflow guidance
- Included Notion API property format examples
- Added note about using `forceRefresh` when encountering schema errors

## Design Decisions

1. **Pass-through API format**: Properties are passed directly to Notion API rather than using a simplified schema. This maximizes flexibility but requires the LLM to understand Notion's property format.

2. **Error-and-retry pattern**: Agent instructions guide the LLM to read API errors and adjust format, enabling self-correction.

3. **Cache-first with refresh**: Default behavior uses cache for speed; `forceRefresh` handles schema drift.
