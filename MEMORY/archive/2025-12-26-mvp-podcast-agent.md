# Build Summary

Last Updated: 2025-12-26

## Overview
This project is the foundation for a personal web-first agent assistant with podcast/video recommendations and Notion integration capabilities.

## What Has Been Built

### 1. Podcast Agent (`src/agents/podcast-agent/`)
A CLI-based conversational agent for managing podcast subscriptions and discovering episodes.

**Entry point:** [index.ts](src/agents/podcast-agent/index.ts)
- Uses Vercel AI SDK's `ToolLoopAgent` with streaming
- Model: `google/gemini-3-flash` (main agent) + `deepseek/deepseek-v3.2` (episode ranking)
- Interactive readline-based chat interface
- Telemetry enabled via Langfuse

**Tools implemented:**
| Tool | File | Description |
|------|------|-------------|
| `check_duplicate` | [check-duplicate.ts](src/agents/podcast-agent/tools/check-duplicate.ts) | Checks if a podcast already exists before searching |
| `podcast_search` | [podcast-search.ts](src/agents/podcast-agent/tools/podcast-search.ts) | Searches iTunes API for podcasts, auto-detects CN/US by Chinese characters |
| `save_podcast` | [save-podcast.ts](src/agents/podcast-agent/tools/save-podcast.ts) | Saves confirmed podcast to TOML file |
| `recommend_episodes` | [recommend-episodes.ts](src/agents/podcast-agent/tools/recommend-episodes.ts) | AI-powered episode recommendations from saved podcasts |

**Utilities:**
| Utility | File | Description |
|---------|------|-------------|
| TOML Reader | [toml-reader.ts](src/agents/podcast-agent/utils/toml-reader.ts) | Reads and deduplicates podcast entries |
| TOML Writer | [toml-writer.ts](src/agents/podcast-agent/utils/toml-writer.ts) | Appends new podcasts to TOML file |
| RSS Fetcher | [rss-fetcher.ts](src/agents/podcast-agent/utils/rss-fetcher.ts) | Fetches and parses podcast RSS feeds |
| Episode Recommender | [episode-recommender.ts](src/agents/podcast-agent/utils/episode-recommender.ts) | LLM-based episode ranking engine |

**Configuration:**
| Config | File | Description |
|--------|------|-------------|
| Recommendation Config | [recommendation-config.ts](src/agents/podcast-agent/config/recommendation-config.ts) | User interest profile and filtering criteria |

**Data storage:** `AGENT_WORKING_FOLDER/podcasts.toml`

### 2. Telemetry Infrastructure
**Langfuse integration for observability:**
- [instrumentation.ts](instrumentation.ts) - Next.js instrumentation file using `@vercel/otel` + `langfuse-vercel`
- Individual agent-level telemetry using `@langfuse/otel` SpanProcessor for dev/testing

### 3. Development Scripts
| Script | File | Description |
|--------|------|-------------|
| AI Gateway Test | [test-gateway.ts](scripts/test-gateway.ts) | Minimal chat loop testing Vercel AI SDK + Gateway |
| RSS Parser Test | [test-rss-parser.ts](scripts/test-rss-parser.ts) | Debug tool for testing RSS feed parsing |

## Tech Stack in Use
| Category | Technology |
|----------|------------|
| Runtime | Node.js with ESM (`"type": "module"`) |
| Agent Framework | Vercel AI SDK (`ai` package) |
| LLM Access | Vercel AI Gateway (OpenAI-compatible) |
| Schema Validation | Zod |
| Data Storage | TOML files (`@iarna/toml`) |
| RSS Parsing | rss-parser |
| Telemetry | Langfuse + OpenTelemetry |
| Dev Tooling | tsx, TypeScript |

## Run Commands
```bash
pnpm podcast-agent                                # Start the podcast agent CLI
pnpm tsx scripts/test-rss-parser.ts <feedUrl>    # Test RSS parser on a feed
```

## What's NOT Built Yet
Per the product vision in CLAUDE.md:
- [ ] Next.js frontend with chat UI
- [ ] Notion integration (query/create/update)
- [ ] Media upload capability
- [ ] Video recommendation agent
- [ ] Voice input support
- [ ] Streaming response UI

## Git History
| Commit | Description |
|--------|-------------|
| `dbd5940` | Add parse-rss test; move integration test to dedicated folder |
| `a9c8eba` | Add podcast recommendation feature to podcast-agent |
| `cb71c03` | Add claude guide to add telemetry parameter when creating new agent/llm |
| `abca271` | Add rss-parser |
| `734f8ea` | Doc: podcast agent mvp |
| `5631974` | Test script for Vercel SDK and gateway |
| `bb5e11f` | Gotchas on Langfuse telemetry config |
| `891d2df` | Podcast agent with search, duplicate check, save tools |
| `e65c4c0` | Package setup: ai-sdk, toml, langfuse, dotenv |
| `81a6bef` | Bootstrap minimal CLAUDE.md |
| `e7fbbdb` | Initial commit |
