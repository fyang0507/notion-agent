# Refactor: Skill System Data Architecture

## Problems Identified

1. **Bloated system prompt** - Skill creation/editing workflows are in main instructions, violating progressive disclosure. Most interactions don't need this.

2. **Decoupled data** - Datasource schemas (TOML) and skills (SKILL.md) are conceptually related but stored separately:
   - `AGENT_WORKING_FOLDER/notion_datasources.toml`
   - `src/agents/notion-agent/skills/<name>/SKILL.md`

3. **Skills in source tree** - Agent-modifiable data shouldn't live in `src/`. Skills should be in `AGENT_WORKING_FOLDER`.

---

## Proposed Solution

### New Directory Structure

```
AGENT_WORKING_FOLDER/
└── notion/
    └── datasources/
        ├── 2025 Progress Tracker/
        │   ├── schema.toml       # Cached schema (auto-managed)
        │   └── SKILL.md          # User instructions (optional)
        ├── 写作/
        │   ├── schema.toml
        │   └── SKILL.md
        └── _drafts/              # Staging area for skill edits
            └── <name>/
                └── SKILL.md
```

**Benefits:**
- Schema and skill for each datasource are co-located
- All agent-modifiable data in `AGENT_WORKING_FOLDER`
- Source tree remains code-only
- Each datasource is self-contained

### Progressive Disclosure for Meta-Skills

Move skill editing instructions OUT of main system prompt. Instead:

**In system prompt (minimal):**
```
## Skill Commands
- skill list              - List available skills
- skill read <name>       - Read skill instructions
- skill info <name>       - Show skill metadata
- skill help              - Show all skill commands (including write commands)
```

**Accessed via `skill help` (on-demand):**
```
## Skill Write Commands
- skill draft "<name>" "<content>"  - Create a draft skill
- skill show-draft "<name>"         - Show draft content
- skill commit "<name>"             - Commit draft to active
- skill discard "<name>"            - Delete draft
- skill check "<name>"              - Show datasource schema
```

**Trigger:** Agent calls `skill help` when it encounters a situation requiring skill creation/editing (new datasource without skill, schema error).

---

## User Decisions

- **Migration:** Clean up immediately after successful migration
- **`skill help` output:** Command reference only (brief descriptions, agent figures out workflow)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/agents/notion-agent/utils/datasource-toml.ts` | Rename to `datasource-store.ts`, change to per-directory structure |
| `src/agents/notion-agent/skills/index.ts` | Update paths to `AGENT_WORKING_FOLDER/notion/datasources/`, add `skill help` |
| `src/agents/notion-agent/index.ts` | Remove verbose workflow docs from system prompt, keep minimal |
| `scripts/test-skills.ts` | Update paths, test migration |

---

## Implementation Order

1. **datasource-store.ts** - New storage pattern with migration
2. **skills/index.ts** - Update skill paths to match new structure, add `skill help`
3. **index.ts** - Trim system prompt, rely on `skill help` for write commands
4. **test-skills.ts** - Update and verify
5. **Manual cleanup** - Remove old `_template/` from source tree (keep as reference in MEMORY/ if needed)

---

## Migration Strategy

On first run after update:
1. Check if old locations exist (`notion_datasources.toml`, `src/.../skills/`)
2. Create new directory structure
3. Parse old TOML, create per-datasource directories with schema.toml
4. Move SKILL.md files to corresponding datasource directories
5. Clean up old locations immediately after successful migration
