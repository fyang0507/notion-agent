# Plan: Notion Agent Skill System

**Date:** 2025-12-28
**Status:** Implemented (2025-12-29) - see progress/2025-12-29-skill-system-implementation.md

## Problem Statement
When creating Notion pages, the agent doesn't know:
- Which fields are required vs optional vs intentionally blank
- When to ask user for input vs use defaults
- Database-specific operational workflows

## Design Principle
**Agent-led progressive disclosure** (inspired by [openskills](https://github.com/numman-ali/openskills)):
- Agent receives instructions on how to discover and read skills
- Agent proactively reads skill content when working with a datasource
- Full instructions loaded on-demand, not injected automatically

**Separation of concerns:**
- **Tool annotation** → General Notion API format guidance (stays in `create-page.ts`)
- **Skills** → Datasource-specific operational rules (SKILL.md per database)

Skills use Anthropic's official format: SKILL.md with YAML frontmatter.
1:1 mapping: Each datasource gets its own skill file.

---

## File Structure

```
src/agents/notion-agent/
├── index.ts                    # Agent with shell tool + skill list
├── tools/
│   ├── search-datasource.ts
│   ├── create-page.ts
│   └── execute-command.ts      # NEW: Shell execution wrapper (Option B)
├── skills/
│   ├── index.ts                # scanSkills(), readSkill(), getSkillList()
│   ├── 写作/SKILL.md            # (user-authored)
│   ├── 2025-progress-tracker/SKILL.md  # (user-authored)
│   ├── 2026-progress-tracker/SKILL.md  # (user-authored)
│   └── _template/SKILL.md      # Template for new skills
└── utils/
    └── skill-loader.ts         # YAML/markdown parsing
```

---

## Skill File Format (Anthropic-compliant)

Skills **reference** schema from TOML, adding only operational rules:

```yaml
---
name: your-database-name
description: Brief description of when/how to use this database
datasource_id: "your-datasource-uuid"
---

# Database Name

## Required Fields
List fields that MUST have values. Specify behavior when not provided.

## Optional Fields with Defaults
List fields with default values or inference rules.
Format: `- **FieldName**: [Default behavior]. [When to ask user]`

## Workflow
Step-by-step instructions for creating entries.

## Notes
Any special considerations or edge cases.
```

**Key principle**: Skills reference property names (e.g., "Tags") but don't duplicate options/types - those come from TOML schema.

---

## How Skills Are Loaded (Agent-Led Progressive Disclosure)

**Two-level loading** (like openskills):

### Level 1: Metadata in System Prompt
Agent instructions include available skills list + how to read them.

### Level 2: Agent Reads Full Content On-Demand
Agent proactively executes command to read skill when working with a datasource.

---

## Shell Execution Options

Four approaches to give the agent skill reading capability:

---

### Option A: Shell Tool (Provider-Specific) ✅ SELECTED

**Trade-off:** Ties to provider's model, but native integration.

```typescript
import { openai } from "@ai-sdk/openai";

const shell = openai.tools. localShelll({
  execute: async ({ action }) => {
    // Execute action.commands in local environment
    // Need to implement actual shell execution
  },
});

const agent = new ToolLoopAgent({
  model: openai("gpt-5.2"),  // Must use supported provider
  tools: { shell, search_datasource, create_page },
});
```

**Requires:**
- Switch model from Gemini to OpenAI
- Implement shell execution handler

**Pros:** Native provider integration, follows OpenAI's tool pattern
**Cons:** Locks to OpenAI, not model-agnostic

---

### Option B: Vercel Sandbox (Model-Agnostic)

**Trade-off:** More setup, but works with any model. True sandboxing.

```typescript
import { Sandbox } from '@vercel/sdk';
import { tool } from 'ai';

const executeCommand = (sandbox: Sandbox) => tool({
  description: 'Execute shell command to read skills or explore files',
  inputSchema: z.object({ command: z.string() }),
  execute: async ({ command }) => sandbox.run(command),
});

// Setup
const sandbox = new Sandbox();
await sandbox.start();
await sandbox.writeFiles({ '/skills/...': skillContent });

const agent = new ToolLoopAgent({
  model: 'google/gemini-3-flash',  // Any model
  tools: { execute_command: executeCommand(sandbox), ... },
});
```

**Requires:**
- Add `@vercel/sdk` dependency
- Vercel authentication (`vercel env pull` for OIDC token)
- Sandbox lifecycle management (start/stop)

**Pros:** Model-agnostic, true sandboxing, follows [Vercel's file system agent pattern](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools)
**Cons:** Requires Vercel auth, sandbox billing, more setup

---

### Option C: just-bash Package (Model-Agnostic)

**Trade-off:** Sandboxed bash without Vercel infrastructure.

```typescript
import { createBashTool } from "just-bash/ai";

const bashTool = createBashTool({
  files: { "/skills/写作/SKILL.md": skillContent },
});

const agent = new ToolLoopAgent({
  model: 'google/gemini-3-flash',
  tools: { bash: bashTool, ... },
});
```

**Requires:**
- Add `just-bash` dependency
- Mount skill files into sandbox

**Pros:** Model-agnostic, sandboxed (writes stay in memory), no Vercel auth
**Cons:** Another dependency, may be overkill for just reading files

**Reference:** [just-bash GitHub](https://github.com/vercel-labs/just-bash)

---

### Option D: Custom `read_skill` Tool (Simplest)

**Trade-off:** Not bash-based, but simplest implementation.

```typescript
import { tool } from 'ai';

const readSkill = tool({
  description: 'Read operational guidance for a datasource skill',
  inputSchema: z.object({
    name: z.string().describe('Skill name (e.g., "写作")'),
  }),
  execute: async ({ name }) => {
    const content = loadSkillContent(name);
    return { content };
  },
});

const agent = new ToolLoopAgent({
  model: 'google/gemini-3-flash',
  tools: { read_skill: readSkill, ... },
});
```

**Requires:**
- Create `tools/read-skill.ts`
- No external dependencies

**Pros:** Simplest, no dependencies, model-agnostic, still agent-led
**Cons:** Not bash-based (less like openskills pattern)

---

## Decision

**Selected: Option A (OpenAI Shell Tool)**

Rationale: Provider-specific implementation with native shell tool support.

---

## Integration Points

### 1. Skill Registry (`skills/index.ts`)

Core utilities for skill management:

```typescript
export interface SkillMetadata {
  name: string;
  description: string;
  datasourceId: string;
}

export function scanSkills(): SkillMetadata[];
export function readSkill(name: string): string | null;
export function getSkillList(): string; // Formatted for system prompt
```

### 2. Agent Instructions (`index.ts`)

Update system prompt with skill discovery guidance:

```typescript
const skillList = getSkillList();

const instructions = `
You are a Notion assistant...

${skillList}

## Skill Usage
Before creating a page, use the execute_command tool to read the skill:
  cat /skills/<skill-name>/SKILL.md

The skill will tell you:
- Which fields are required vs optional
- Default values to use
- When to ask the user for input
`;
```

### 3. Shell/Command Execution Tool

**Option A (OpenAI):** Use `openai.tools. localShelll()` with custom execute handler
**Option B (Vercel Sandbox):** Create `execute_command` tool wrapping `sandbox.run()`

Both options mount skills at `/skills/<name>/SKILL.md` for agent access.

---

## Files to Create

| File | Purpose |
|------|---------|
| `skills/index.ts` | `scanSkills()`, `readSkill()`, `getSkillList()` |
| `utils/skill-loader.ts` | Parse SKILL.md (frontmatter + body) |
| `skills/_template/SKILL.md` | Template for creating new skills |
| `tools/execute-command.ts` | Shell execution tool (Option B only) |

**User-authored** (created later by you):
- `skills/写作/SKILL.md`
- `skills/2025-progress-tracker/SKILL.md`
- `skills/2026-progress-tracker/SKILL.md`

## Files to Modify

| File | Changes |
|------|---------|
| `index.ts` | Add shell tool + skill list to instructions |
| `package.json` | Add `gray-matter` + shell execution dependency |

**Option A (OpenAI):** No new tool file needed; use `openai.tools. localShelll()`
**Option B (Vercel Sandbox):** Add `@vercel/sdk`, create `execute-command.ts`

---

## Example Flow (Agent-Led)

```
User: "Add a new blog post about my trip to Japan"
       ↓
Agent: Sees "写作" in <available_skills>, decides to read it first
       ↓
Agent: Calls execute_command({ command: "cat /skills/写作/SKILL.md" })
       ↓
Tool: Returns full SKILL.md content to agent context
       ↓
Agent: Reads skill → "Name required, Tags: infer or ask..."
       ↓
Agent: Asks user: "What's the title for this blog post?"
       ↓
User: "My Trip to Japan"
       ↓
Agent: Skill says infer Tags → "Travel content = 游记"
       ↓
Agent: Calls create_page with complete properties
       ↓
Tool: Creates page, returns URL
```

**Key difference**: Agent *proactively* reads skill before attempting create_page, rather than receiving guidance in tool response.

---

## Implementation Phases (Option A: OpenAI Shell Tool)

### Phase 1: Dependencies
1. Ensure `@ai-sdk/openai` is installed (already have it)
2. Add `gray-matter` dependency for YAML frontmatter parsing

### Phase 2: Skill Infrastructure
3. Create `utils/skill-loader.ts` with `parseSkillFile()` function
4. Create `skills/index.ts` with `scanSkills()`, `readSkill()`, `getSkillList()`

### Phase 3: Shell Execution Setup
5. Configure `openai.tools. localShelll()` with execute handler
6. Implement shell command execution (for `cat`, `ls` on skills directory)

### Phase 4: Template & Agent Instructions
7. Create `skills/_template/SKILL.md` with documented structure
8. Update `index.ts`:
   - Switch model from Gemini to OpenAI
   - Add shell tool
   - Inject skill list into agent instructions

### Phase 5: Testing
9. Create a test skill to validate shell execution
10. Test agent behavior: does it proactively read skills?

---

## Critical Files

- [index.ts](src/agents/notion-agent/index.ts) - Agent instructions to update
- [datasource-toml.ts](src/agents/notion-agent/utils/datasource-toml.ts) - Pattern reference for skill loader
- [notion_datasources.toml](AGENT_WORKING_FOLDER/notion_datasources.toml) - Schema reference for skills
- [package.json](package.json) - Add dependency and script

---

## References

- [Anthropic Skills Spec](https://github.com/anthropics/skills)
- [OpenSkills (open-source implementation)](https://github.com/numman-ali/openskills)
- [Vercel Sandbox Docs](https://vercel.com/docs/vercel-sandbox)
- [Vercel's File System Agent Pattern](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools)
- [just-bash Package](https://github.com/vercel-labs/just-bash)
- [OpenAI Local Shell Tool](https://ai-sdk.dev/providers/ai-sdk-providers/openai#local-shell-tool)
