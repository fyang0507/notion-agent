# Project Changelog

Last Updated: 2025-12-26

## Recent Changes

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
