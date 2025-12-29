# Skill Data Architecture Refactor

Last Updated: 2025-12-29

## Summary

Refactored the Notion agent's data storage architecture to consolidate datasource schemas and skills into a single, per-datasource directory structure outside the source tree. Implemented progressive disclosure to reduce system prompt complexity.

## Problems Solved

1. **Decoupled data**: Schema (`notion_datasources.toml`) and skills (`src/.../skills/`) were stored separately despite being conceptually related
2. **Skills in source tree**: Agent-modifiable data was inside `src/`, mixing runtime data with code
3. **Bloated system prompt**: Full skill write workflow documentation was always included, even when unused

## New Architecture

```
AGENT_WORKING_FOLDER/notion/datasources/
├── <DatasourceName>/
│   ├── schema.toml     # Cached Notion schema (auto-managed)
│   └── SKILL.md        # User instructions (optional)
└── _drafts/            # Staging area for skill edits
```

## Key Changes

### New File: `datasource-store.ts`
- Replaced `datasource-toml.ts` with folder-based storage
- Each datasource gets its own directory with `schema.toml`
- Added `getDatasourcePath()`, `getSkillPath()`, `getDraftsDir()` exports
- Auto-migration from old structure runs on first access

### Updated: `skills/index.ts`
- Skills now scanned from `AGENT_WORKING_FOLDER/notion/datasources/`
- Removed `skill info` command (redundant with `skill read`)
- Added `skill help` command with full write workflow documentation
- All path functions updated to use new `datasource-store.ts` exports

### Updated: `index.ts` System Prompt
- Reduced from ~80 lines to ~35 lines of instructions
- Write commands summarized as "use `skill help` for details"
- Removed verbose error recovery and skill creation workflows

### Migration Logic
When `readDatasources()` is called:
1. Detects if old `notion_datasources.toml` exists
2. Parses and creates per-datasource directories with `schema.toml`
3. Moves any `SKILL.md` files from `src/.../skills/` to new location
4. Cleans up old file and directories

## Files Modified

| File | Change |
|------|--------|
| `src/agents/notion-agent/utils/datasource-store.ts` | NEW - replaces datasource-toml.ts |
| `src/agents/notion-agent/utils/datasource-toml.ts` | DELETED |
| `src/agents/notion-agent/skills/index.ts` | Updated paths, added `skill help` |
| `src/agents/notion-agent/index.ts` | Simplified system prompt |
| `src/agents/notion-agent/skills/2025 Progress Tracker/` | DELETED (migrated) |
| `src/agents/notion-agent/skills/_template/` | DELETED (moved to MEMORY) |
| `scripts/test-skills.ts` | Updated imports and test cases |

## Template Preservation

The skill template was moved to `MEMORY/templates/skill-template/SKILL.md` for reference.
