# Vercel Deployment & GitHub Sync Implementation

Last Updated: 2026-01-01

## Overview

Prepared the app for Vercel deployment with two key features:
1. Conditional Langfuse telemetry (disabled when credentials not present)
2. GitHub sync for AGENT_WORKING_FOLDER (agent writes → GitHub commit)

## Architecture

### GitHub Sync Flow
```
Agent writes file locally
       ↓
fs.writeFileSync(path, content)
       ↓
syncFileToGitHub(path, content).catch(console.error)  // fire-and-forget
       ↓
GitHub API creates/updates file on vercel-agent-commit branch
       ↓
Vercel detects commit → auto-redeploy (if configured)
```

### Key Design Decisions
- **Fire-and-forget**: Sync doesn't block agent response; errors logged to console
- **Dedicated branch**: `vercel-agent-commit` keeps main clean for review/merge
- **Auto-branch creation**: Uses repo's default branch (not hardcoded "main")
- **Graceful skip**: No-op when `GITHUB_TOKEN` or `GITHUB_REPO` not set

## Files Created/Modified

| File | Purpose |
|------|---------|
| `src/lib/github-sync.ts` | Octokit-based sync utility |
| `src/instrumentation.ts` | Conditional Langfuse init |
| `src/skills/podcast/utils/toml-writer.ts` | Sync hook for podcasts.toml |
| `src/skills/notion/utils/datasource-store.ts` | Sync hook for schema.toml |
| `src/skills/notion/index.ts` | Sync hook for SKILL.md |
| `scripts/test-github-sync.ts` | Idempotent test script |

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | Personal access token with `repo` scope |
| `GITHUB_REPO` | Repository in `owner/repo` format |
| `AI_GATEWAY_API_KEY` | OpenAI/AI provider key |
| `GROQ_API_KEY` | Voice transcription (Whisper) |
| `NOTION_TOKEN` | Notion API operations |

## Test Script

Run: `pnpm tsx scripts/test-github-sync.ts`

The test is idempotent:
1. Creates test file in `AGENT_WORKING_FOLDER/.test/`
2. Syncs to GitHub on `vercel-agent-commit` branch
3. Verifies content matches
4. Deletes from GitHub and local

## Status

- Implementation: Complete
- Test: Requires valid `GITHUB_TOKEN` and `GITHUB_REPO` in `.env`
- Deployment: Ready for Vercel with Turso integration
