## Product Vision

Personal web agent with chat UI + voice input for:
1. Podcast/video recommendations
2. Notion operations (query/create/update)

## Architecture Notes

- **Single-user**: Conversations in localStorage, no auth
- **Agent factory**: Vercel AI SDK + AI Gateway, `src/agents/web-agent.ts` for web, `src/agents/index.ts` for CLI
- **Telemetry**: Self-hosted Langfuse via OpenTelemetry

## Project Memory

MEMORY/ holds plans and context docs. Check when needing more background.
