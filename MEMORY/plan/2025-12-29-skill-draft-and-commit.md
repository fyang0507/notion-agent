# Agent-Human Collaborative Skill Editing

## Goal
Enable the agent to collaboratively create and update SKILL.md files with the user, triggered by:
1. New datasources discovered without existing skills
2. Schema errors during page creation (indicating schema changes)

## User Preferences
- **Edit mode**: Interactive Q&A → generate skill file
- **Workflow**: Same-session, agent drafts then commits after user approval
- **New datasource**: Always prompt for skill creation

---

## Design: Staging + Commit Pattern

All skill operations use shell commands for consistency. Writing uses a two-step process:

```
Agent: [generates skill content via Q&A]
Agent: [calls `skill draft "name" "content"`] → saved to _drafts/
Agent: "Here's the skill I've drafted: [shows content]. Should I save it?"
User: "Yes" / "Make these changes..."
Agent: [calls `skill commit "name"`] → moves to active skills
```

**Safety mechanism**: Agent instructions require showing draft and waiting for user confirmation before commit.

---

## Implementation Plan

### Phase 1: Add Skill Write Commands

**File: `src/agents/notion-agent/skills/index.ts`**

```typescript
// Constants
const DRAFTS_DIR = path.join(SKILLS_DIR, '_drafts');

// New functions
export function draftSkill(name: string, content: string): { success: boolean; message: string }
// - Validates frontmatter has `name` and `description`
// - Creates _drafts/name/ directory
// - Writes SKILL.md to draft location

export function commitSkill(name: string): { success: boolean; message: string }
// - Verifies draft exists
// - Moves _drafts/name/ to skills/name/
// - Overwrites if skill already exists

export function discardDraft(name: string): { success: boolean; message: string }
// - Removes _drafts/name/ directory

export function readDraft(name: string): string | null
// - Returns draft content if exists

// New commands in createSkillCommands()
'skill draft': (args) => {
  // Parse: "name" "content"
  // Calls draftSkill()
}

'skill commit': (name) => {
  // Calls commitSkill()
}

'skill discard': (name) => {
  // Calls discardDraft()
}

'skill show-draft': (name) => {
  // Calls readDraft(), returns content
}

'skill check': (name) => {
  // Returns datasource schema from cache for comparison
}
```

**Argument parsing for multi-line content**:
- `skill draft` receives `"name" "content"` as quoted strings
- Content can include newlines since shell executor handles quoted args
- Existing `stripQuotes()` in shell-executor.ts handles this

### Phase 2: Update Agent Instructions

**File: `src/agents/notion-agent/index.ts`**

Add to agent instructions:

1. **Skill write commands documentation**:
   ```
   ## Skill Write Commands
   - skill draft "<name>" "<content>"  - Create a draft skill (validates frontmatter)
   - skill show-draft "<name>"         - Show draft content for review
   - skill commit "<name>"             - Move draft to active skills
   - skill discard "<name>"            - Delete a draft
   - skill check "<name>"              - Show datasource schema for reference
   ```

2. **New datasource workflow**:
   - After `search_datasource` succeeds, check if skill exists via `skill info`
   - If not found, ask user: "Would you like to create a skill for [name]?"
   - If yes, start skill creation flow (ask description, then content)

3. **Schema error workflow**:
   - On `create_page` failure with schema error
   - Call `search_datasource` with `forceRefresh: true`
   - Use `skill check <name>` to see updated schema
   - Show user what changed and ask how to update the skill instructions

4. **Skill creation flow**:
   - Ask for description: "What is this database used for?"
   - Ask for content: "What instructions should I follow when creating entries?"
   - User provides freeform instructions
   - If content seems incomplete (e.g., missing guidance for key fields), ask clarifying questions
   - Generate SKILL.md from user's input

5. **Draft-Commit workflow instruction**:
   ```
   IMPORTANT: When creating or updating skills:
   1. Use `skill draft` to save your generated content
   2. Show the draft content to the user and ask for confirmation
   3. Only call `skill commit` after user explicitly approves
   4. If user requests changes, update the draft and show again
   ```

6. **SKILL.md format**:
   - **Required**: YAML frontmatter with `name` and `description`
   - **Body**: Freeform markdown - agent structures content as appropriate for the datasource
   - No enforced sections; agent decides what information is useful to capture

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/agents/notion-agent/skills/index.ts` | Add `draftSkill`, `commitSkill`, `discardDraft`, `readDraft` + new commands |
| `src/agents/notion-agent/index.ts` | Update instructions with draft-commit workflow |
| `scripts/test-skills.ts` | Add tests for draft/commit/discard/show-draft/check commands |

---

## Example Flows

### Flow 1: New Datasource
```
User: "Find my Reading List database"
Agent: [calls search_datasource] → Found, schema cached
Agent: [calls skill info "Reading List"] → Not found
Agent: "I found 'Reading List' but there's no skill. Create one?"
User: "Yes"
Agent: "What is this database used for?"
User: "Tracking books I want to read"
Agent: "What instructions should I follow when creating entries?"
User: "Default status to 'To Read'. Always ask for the book title. Date should be today."
Agent: [generates SKILL.md from user input]
Agent: [calls skill draft "Reading List" "<content>"]
Agent: "Here's the skill I've drafted: [shows content]. Should I save it?"
User: "Yes"
Agent: [calls skill commit "Reading List"]
Agent: "Skill created for Reading List!"
```

### Flow 2: Schema Error → Update Skill
```
User: "Add 'Dune' to Reading List"
Agent: [reads skill, calls create_page] → Error: invalid option 'In Progress'
Agent: "Schema might have changed. Let me refresh..."
Agent: [calls search_datasource with forceRefresh]
Agent: [calls skill check "Reading List"]
Agent: "Status options changed. New options: [To Read, Reading, Completed].
        How should I update the skill instructions?"
User: "Default to 'To Read' instead"
Agent: [updates skill content]
Agent: [calls skill draft "Reading List" "<updated content>"]
Agent: "Here's the updated skill: [shows content]. Save it?"
User: "Yes"
Agent: [calls skill commit "Reading List"]
Agent: "Skill updated! Now creating the page..."
Agent: [calls create_page with corrected Status]
```

### Flow 3: User Requests Changes to Draft
```
Agent: [calls skill draft "Reading List" "<content>"]
Agent: "Here's the skill I've drafted: [shows content]. Should I save it?"
User: "Change the default date to 'ask user' instead of 'today'"
Agent: [updates content]
Agent: [calls skill draft "Reading List" "<updated content>"]
Agent: "Updated. Here's the new version: [shows content]. Save it?"
User: "Yes"
Agent: [calls skill commit "Reading List"]
```

---

## Directory Structure

```
src/agents/notion-agent/skills/
├── index.ts                    # Skill functions + commands
├── _template/
│   └── SKILL.md               # Template for reference
├── _drafts/                   # NEW: Staging area
│   └── <skill-name>/
│       └── SKILL.md
├── 2025 Progress Tracker/
│   └── SKILL.md
└── <other-skills>/
    └── SKILL.md
```

---

## Phase 3: Update Test Script

**File: `scripts/test-skills.ts`**

Add tests for the new write commands:

```typescript
// Test 5: Draft skill
console.log('\n5. Skill draft commands:');
const testContent = `---
name: Test Database
description: Test skill for validation
---

Default status to "Active".
`;

const draftResult = exec(`skill draft "Test Database" "${testContent}"`);
console.log(`   skill draft: ${draftResult.includes('success') ? '[OK]' : '[FAIL] ' + draftResult}`);

// Test 6: Show draft
console.log('\n6. Show draft:');
const showResult = exec('skill show-draft "Test Database"');
console.log(`   skill show-draft: ${showResult.includes('Default status') ? '[OK]' : '[FAIL] ' + showResult}`);

// Test 7: Commit skill
console.log('\n7. Commit skill:');
const commitResult = exec('skill commit "Test Database"');
console.log(`   skill commit: ${commitResult.includes('success') ? '[OK]' : '[FAIL] ' + commitResult}`);

// Verify skill now exists
const verifyResult = exec('skill info "Test Database"');
console.log(`   skill exists: ${verifyResult.startsWith('Name:') ? '[OK]' : '[FAIL]'}`);

// Test 8: Discard (cleanup - delete the test skill)
console.log('\n8. Cleanup:');
// Delete the committed skill directory manually or add a delete command
```

**Test cases to cover**:
- `skill draft` with valid content → creates file in `_drafts/`
- `skill draft` with missing frontmatter → returns validation error
- `skill show-draft` for existing draft → returns content
- `skill show-draft` for non-existent draft → returns error
- `skill commit` for existing draft → moves to active, removes draft
- `skill commit` for non-existent draft → returns error
- `skill discard` removes draft directory
- `skill check` returns datasource schema from cache
- Multi-line content preserved through quoted args

---

## Testing Checklist
- [ ] `skill draft` creates draft in _drafts/ with frontmatter validation
- [ ] `skill show-draft` returns draft content
- [ ] `skill commit` moves draft to active skills
- [ ] `skill commit` overwrites existing skill if present
- [ ] `skill discard` removes draft
- [ ] `skill check` shows datasource schema
- [ ] Agent prompts for skill creation on new datasource
- [ ] Agent prompts for skill update on schema error
- [ ] Agent shows draft and waits for confirmation before commit
- [ ] Multi-line content preserved through shell command parsing
- [ ] Test script passes all new test cases
