# Project Changelog

Last Updated: 2025-12-29

## Recent Changes

### 2025-12-29: Notion Agent - Skill System Implementation
- Implemented agent-led skill system using OpenAI shell tool with custom command executor
- Created `skills/index.ts` for skill scanning (YAML frontmatter parsing) and `skill list/read/info` commands
- Added first skill `2025 Progress Tracker` with database-specific field requirements and workflow guidance

### 2025-12-28: Notion Agent - Create Page Tool
- Added `create_page` tool for creating pages in Notion databases with properties in Notion API format
- Refactored `search_datasource`: removed auto-save param, added `forceRefresh` for cache bypass, auto-saves all matches
- Removed separate `save_datasource` tool (functionality merged into search workflow)
- Updated agent instructions with page creation workflow and property format examples

### 2025-12-28: Notion Agent - Database Discovery & Cataloging
- Created `notion-agent` for discovering and cataloging Notion databases with schema extraction
- Implemented `search_datasource` and `save_datasource` tools using Notion API + LLM-powered metadata extraction
- Built TOML-based caching system for datasource metadata in `AGENT_WORKING_FOLDER/notion_datasources.toml`
- Added debug script `scripts/search-notion-database.ts` for testing Notion database search

### 2025-12-26: Podcast Episode Recommendation Feature
- Added `recommend_episodes` tool to podcast-agent for AI-powered episode recommendations
- Implemented RSS feed parsing with `rss-parser` for fetching recent episodes from saved podcasts
- Created configurable recommendation system with user interest scoring (AI/ML, history, politics, investing, etc.)
- Built debug script `scripts/test-rss-parser.ts` for testing RSS feed parsing
- Added LLM-based ranking using deepseek-v3.2 model to curate personalized recommendations

### 2025-12-26: Code Organization
- Moved `test-gateway.ts` to `scripts/` folder for better project structure
- Added `src/agents/CLAUDE.md` with telemetry setup guidelines for new agents

### 2025-12-26: Initial Podcast Agent MVP
- Built CLI-based podcast agent with search, duplicate check, and save functionality
- Implemented iTunes API integration for podcast discovery (CN/US region auto-detection)
- Set up Langfuse telemetry for agent observability
- Created TOML-based data storage for podcast subscriptions
