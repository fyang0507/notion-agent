# Vercel Deployment & Agent Filesystem Abstraction

Last Updated: 2026-01-01

## Overview

Solved Vercel's read-only filesystem limitation with an environment-aware abstraction layer (`agent-fs`) that:
- Local development: Uses direct filesystem operations
- Vercel deployment: Uses GitHub API to read/write to `vercel-agent-commit` branch

## Architecture

### Agent-FS Flow
```
agentFS()  →  isVercelWithGitHub()?
                    ↓
    ┌───────────────┴───────────────┐
    │ Yes                           │ No
    ↓                               ↓
githubFS                        localFS
(Octokit → GitHub API)      (fs → filesystem)
```

### Key Design Decisions
- **Environment Detection**: `VERCEL` + `GITHUB_TOKEN` + `GITHUB_REPO` → GitHub backend
- **Async-First**: All operations return Promises for consistent API
- **Relative Paths**: All paths relative to `AGENT_WORKING_FOLDER`
- **Singleton Pattern**: Single instance via `agentFS()` helper
- **Transparent to Human**: Files visible in GitHub repo, not hidden in database

## Files Created/Modified

| File | Purpose |
|------|---------|
| `src/lib/agent-fs/types.ts` | AgentFS interface definition |
| `src/lib/agent-fs/local.ts` | Local filesystem implementation |
| `src/lib/agent-fs/github.ts` | GitHub API implementation |
| `src/lib/agent-fs/index.ts` | Environment-aware factory |
| `src/skills/podcast/utils/podcast-store.ts` | Consolidated podcast storage |

### Removed Files
- `src/lib/github-sync.ts` - Replaced by agent-fs
- `src/skills/podcast/utils/toml-reader.ts` - Merged into podcast-store
- `src/skills/podcast/utils/toml-writer.ts` - Merged into podcast-store

### Updated Files
- `src/agents/index.ts` - `createUnifiedAgent()` now async
- `src/app/api/chat/route.ts` - Added await for createUnifiedAgent
- `src/skills/notion/index.ts` - All skill functions now async
- `src/skills/notion/utils/datasource-store.ts` - Async operations
- `scripts/test-skills.ts` - Wrapped in async function

## Environment Variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | Personal access token with `repo` scope |
| `GITHUB_REPO` | Repository in `owner/repo` format |
| `VERCEL` | Auto-set by Vercel (detection trigger) |

## AgentFS Interface

```typescript
interface AgentFS {
  exists(relativePath: string): Promise<boolean>;
  readFile(relativePath: string): Promise<string | null>;
  writeFile(relativePath: string, content: string): Promise<void>;
  readDir(relativePath: string): Promise<DirEntry[]>;
  mkdir(relativePath: string): Promise<void>;
  remove(relativePath: string): Promise<void>;
}
```

## Status

- Implementation: Complete
- TypeScript: All checks pass
- Deployment: Ready (add GITHUB_TOKEN, GITHUB_REPO to Vercel)
