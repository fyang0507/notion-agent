# Podcast Episode Recommendation Feature Implementation

Last Updated: 2025-12-26

## Task Summary
Implemented AI-powered podcast episode recommendation system that fetches recent episodes from all saved podcasts and uses LLM ranking to recommend the most relevant content based on user interests.

## What Was Built

### 1. RSS Feed Fetching Infrastructure
**File**: `src/agents/podcast-agent/utils/rss-fetcher.ts`

Core functionality for retrieving and parsing podcast RSS feeds:
- **Episode Interface**: Structured data format (title, description, pubDate, duration, podcastName)
- **fetchEpisodesFromFeed()**: Parses single RSS feed with timeout protection (10s default)
- **fetchAllEpisodes()**: Parallel fetching across all saved podcasts using Promise.allSettled
- **Date Filtering**: Configurable time window (default: 90 days)
- **Error Resilience**: Continues on individual feed failures, collects error details
- **HTML Stripping**: Cleans episode descriptions from HTML tags
- **Description Truncation**: Limits to 5000 chars to prevent prompt bloat

Key implementation details:
- Uses `rss-parser` library for RSS/Atom feed parsing
- Sorts episodes by publication date (newest first)
- Extracts iTunes-specific metadata (duration)

### 2. Recommendation Configuration System
**File**: `src/agents/podcast-agent/config/recommendation-config.ts`

Centralized configuration for recommendation logic:
- **defaultCriteria**: Detailed user interest profile with 1-5 scoring across categories:
  - AI/ML (5/5): Latest research + fundamentals
  - Investing/Finance (4/5): Market dynamics, macroeconomic trends
  - Entrepreneurship (4/5): First-hand founder stories
  - History (3/5): Macroscopic views with specific focus
  - Politics/Social Science (3/5): Social dynamics across cultures
  - Music (2/5): Theory and song breakdowns
  - Cuisine (2/5): Home-style cooking
  - Crypto (2/5): Fundamentals for wealth building
  - Weird science (1/5): Unusual stories with profound implications
- **Exclusion themes**: Biology, healthcare, entertainment, travel logs, promotional content
- **maxEpisodesPerFeed**: 10 episodes per podcast (prevents overwhelming LLM)
- **feedTimeoutMs**: 10 seconds
- **maxDescriptionLength**: 5000 characters

### 3. LLM-Based Episode Ranking
**File**: `src/agents/podcast-agent/utils/episode-recommender.ts`

AI-powered recommendation engine:
- **loadPodcasts()**: Reads from `AGENT_WORKING_FOLDER/podcasts.toml`
- **formatEpisodeForLLM()**: Structures episodes as numbered candidates with metadata
- **recommendEpisodesFromFeeds()**: Main orchestration function
  - Fetches all episodes from saved podcasts
  - Constructs prompt with default criteria + optional user criteria
  - Uses `generateText()` with `deepseek/deepseek-v3.2` model
  - Returns bullet-point recommendations with reasoning
  - Telemetry enabled via Langfuse

**Prompt Engineering**:
- Presents episodes as numbered candidates
- Combines default user profile with user-specified criteria
- Requests concise explanations for each recommendation

### 4. Agent Tool Integration
**File**: `src/agents/podcast-agent/tools/recommend-episodes.ts`

Vercel AI SDK tool wrapper:
- **Input Schema**:
  - `topN` (default: 3): Number of recommendations
  - `days` (default: 90): Time window for episodes
  - `criteria` (optional): User-specified filtering instructions
- **Returns**: Formatted recommendation text with explanations

### 5. Debug Test Script
**File**: `scripts/test-rss-parser.ts`

Standalone CLI tool for RSS parser validation:
```bash
pnpm tsx scripts/test-rss-parser.ts <feedUrl> [daysBack]
```
- Takes feed URL and optional days parameter
- Outputs formatted episode list with metadata
- Useful for debugging feed parsing issues

### 6. Agent Updates
**File**: `src/agents/podcast-agent/index.ts`

Enhanced agent instructions:
- Added guidance for recommendation workflow
- Note about language inference from title/description
- Instruction to broaden criteria when no matches found
- Tool registration in agent's tools object

**File**: `src/agents/CLAUDE.md` (new)
- Documentation for adding telemetry to new agents/LLM calls
- Reminder to include `experimental_telemetry: { isEnabled: true }`

### 7. Project Structure Improvements
- Moved `test-gateway.ts` → `scripts/test-gateway.ts`
- Established `scripts/` folder for development utilities

## Technical Decisions

### RSS Parser Choice
Selected `rss-parser` library for:
- Simple API for RSS/Atom feed parsing
- Built-in timeout support
- iTunes metadata extraction

### LLM Selection for Ranking
Using `deepseek/deepseek-v3.2` via Vercel AI Gateway:
- Cost-effective for text generation tasks
- Good instruction-following for ranking tasks
- Integration with existing Langfuse telemetry

### Error Handling Strategy
- **Individual feed failures**: Continue processing other feeds
- **All feeds fail**: Return error with collected failure details
- **No episodes in range**: Return informative message
- **LLM ranking failures**: Return error (no fallback to avoid poor UX)

### Configuration Externalization
Separated recommendation criteria to `config/` for:
- Easy customization without code changes
- Clear documentation of user preferences
- Maintainability as interests evolve

## Integration Points

### Data Flow
1. User asks for recommendations via agent
2. Agent calls `recommend_episodes` tool
3. Tool loads podcasts from `AGENT_WORKING_FOLDER/podcasts.toml`
4. RSS fetcher retrieves recent episodes in parallel
5. Episodes formatted and sent to LLM with criteria
6. LLM returns ranked recommendations with reasoning
7. Agent presents results to user

### Dependencies Added
```json
"rss-parser": "^3.13.0"
```

## Testing Approach
1. **RSS Parser**: Test script validates feed parsing for individual podcasts
2. **Integration**: Full workflow tested via `pnpm podcast-agent` CLI
3. **Error Scenarios**: Parallel fetch handles individual feed failures gracefully

## Future Enhancements
Potential improvements identified during implementation:
- Language detection API instead of title-based inference
- Caching of RSS feed results (TTL: 1 hour)
- Incremental fetching (only new episodes since last check)
- Episode download links for offline listening
- Recommendation history tracking (avoid duplicates)
- User feedback loop for ranking improvement

## Git Commits
- `dbd5940`: Add parse-rss test; move integration test to dedicated folder
- `a9c8eba`: Add podcast recommendation feature to podcast-agent
- `cb71c03`: Add claude guide to add telemetry parameter when creating new agent/llm
- `abca271`: Add rss-parser

## Files Created
- `src/agents/podcast-agent/config/recommendation-config.ts`
- `src/agents/podcast-agent/utils/rss-fetcher.ts`
- `src/agents/podcast-agent/utils/episode-recommender.ts`
- `src/agents/podcast-agent/tools/recommend-episodes.ts`
- `scripts/test-rss-parser.ts`
- `src/agents/CLAUDE.md`

## Files Modified
- `src/agents/podcast-agent/index.ts`: Added recommend_episodes tool
- `package.json`: Added rss-parser dependency
- Moved: `test-gateway.ts` → `scripts/test-gateway.ts`
