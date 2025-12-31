## Product Vision

Personal web agent with chat UI + voice input for:
1. Podcast/video recommendations
2. Notion operations (query/create/update)

## Architecture Notes

- **Single-user**: Conversations in localStorage, no auth
- **Agent factory**: Vercel AI SDK + AI Gateway, main agent created in `src/agents/index.ts`
- **Telemetry**: Self-hosted Langfuse via OpenTelemetry

## Project Memory

MEMORY/ holds plans and context docs. Check when needing more background.
