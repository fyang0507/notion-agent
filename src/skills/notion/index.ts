import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import {
  readDatasources,
  getDatasourcePath,
  getSkillPath,
  getDraftsDir,
  getDatasourceByName,
} from './utils/datasource-store.js';

export interface SkillMetadata {
  name: string;
  description: string;
}

/**
 * Get the base path for all datasources
 */
function getDatasourcesBase(): string {
  return path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'notion', 'datasources');
}

/**
 * Scan the datasources directory and return metadata for all skills
 */
export function scanSkills(): SkillMetadata[] {
  // Trigger migration if needed
  readDatasources();

  const basePath = getDatasourcesBase();
  if (!fs.existsSync(basePath)) {
    return [];
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  const skills: SkillMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_drafts') {
      continue;
    }

    const skillPath = path.join(basePath, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(skillPath, 'utf-8');
      const { data } = matter(raw);

      if (data.name && data.description) {
        skills.push({
          name: data.name,
          description: data.description,
        });
      }
    } catch {
      // Skip invalid skill files
    }
  }

  return skills;
}

/**
 * Get a formatted skill list for agent instructions
 */
export function getSkillList(): string {
  const skills = scanSkills();

  if (skills.length === 0) {
    return `## Available Skills\nNo skills configured yet.`;
  }

  const lines = skills.map((s) => `- **${s.name}**: ${s.description}`).join('\n');

  return `## Available Skills\n${lines}`;
}

/**
 * Parse the first quoted argument and return the rest as a second argument.
 * Used for 'notion draft "name" "content"' where content may contain quotes.
 * Returns [name, content] or null if parsing fails.
 */
function parseDraftArgs(input: string): [string, string] | null {
  const trimmed = input.trim();

  // Match first quoted argument
  const firstQuote = trimmed[0];
  if (firstQuote !== '"' && firstQuote !== "'") {
    return null;
  }

  // Find end of first quoted arg
  let i = 1;
  while (i < trimmed.length && trimmed[i] !== firstQuote) {
    i++;
  }
  if (i >= trimmed.length) return null;

  const name = trimmed.slice(1, i);
  const rest = trimmed.slice(i + 1).trim();

  // Match second quoted argument (the content)
  if (rest.length < 2) return null;
  const secondQuote = rest[0];
  if (secondQuote !== '"' && secondQuote !== "'") {
    return null;
  }

  // The content is everything between the quotes (last char should be the closing quote)
  if (!rest.endsWith(secondQuote)) return null;
  const content = rest.slice(1, -1);

  return [name, content];
}

export interface SkillWriteResult {
  success: boolean;
  message: string;
}

/**
 * Validate that content has required frontmatter fields
 */
function validateSkillContent(content: string): { valid: boolean; error?: string } {
  try {
    const { data } = matter(content);
    if (!data.name) {
      return { valid: false, error: 'Missing required frontmatter field: name' };
    }
    if (!data.description) {
      return { valid: false, error: 'Missing required frontmatter field: description' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid frontmatter format' };
  }
}

/**
 * Create a draft skill in the _drafts/ directory
 */
export function draftSkill(name: string, content: string): SkillWriteResult {
  const validation = validateSkillContent(content);
  if (!validation.valid) {
    return { success: false, message: `Error: ${validation.error}` };
  }

  const draftsDir = getDraftsDir();

  // Ensure _drafts directory exists
  if (!fs.existsSync(draftsDir)) {
    fs.mkdirSync(draftsDir, { recursive: true });
  }

  const draftPath = path.join(draftsDir, name);
  if (!fs.existsSync(draftPath)) {
    fs.mkdirSync(draftPath, { recursive: true });
  }

  const skillFile = path.join(draftPath, 'SKILL.md');
  fs.writeFileSync(skillFile, content, 'utf-8');

  return { success: true, message: `Draft saved for "${name}". Use 'notion show-draft "${name}"' to review.` };
}

/**
 * Commit a draft skill to the datasource directory
 */
export function commitSkill(name: string): SkillWriteResult {
  const draftsDir = getDraftsDir();
  const draftPath = path.join(draftsDir, name);
  const draftFile = path.join(draftPath, 'SKILL.md');

  if (!fs.existsSync(draftFile)) {
    return { success: false, message: `Error: No draft found for "${name}". Use 'notion draft' first.` };
  }

  const targetPath = getDatasourcePath(name);
  const targetFile = getSkillPath(name);

  // Create target directory if needed (for skills without schemas)
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  // Copy draft to active location
  const content = fs.readFileSync(draftFile, 'utf-8');
  fs.writeFileSync(targetFile, content, 'utf-8');

  // Remove draft
  fs.rmSync(draftPath, { recursive: true });

  return { success: true, message: `Skill "${name}" committed successfully.` };
}

/**
 * Discard a draft skill
 */
export function discardDraft(name: string): SkillWriteResult {
  const draftsDir = getDraftsDir();
  const draftPath = path.join(draftsDir, name);

  if (!fs.existsSync(draftPath)) {
    return { success: false, message: `Error: No draft found for "${name}".` };
  }

  fs.rmSync(draftPath, { recursive: true });
  return { success: true, message: `Draft "${name}" discarded.` };
}

/**
 * Read a draft skill's content
 */
export function readDraft(name: string): string | null {
  const draftsDir = getDraftsDir();
  const draftFile = path.join(draftsDir, name, 'SKILL.md');
  if (!fs.existsSync(draftFile)) {
    return null;
  }
  return fs.readFileSync(draftFile, 'utf-8');
}

/**
 * Get datasource schema for a given name
 */
export function getDatasourceSchema(name: string): string | null {
  const datasource = getDatasourceByName(name);

  if (!datasource) {
    return null;
  }

  const lines = [`Database: ${datasource.name}`, `ID: ${datasource.id}`, '', 'Properties:'];
  for (const [propName, prop] of Object.entries(datasource.properties)) {
    let line = `  - ${propName} (${prop.type})`;
    if (prop.options && prop.options.length > 0) {
      line += `: ${prop.options.join(', ')}`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Get notion help text (all commands)
 */
function getNotionHelp(): string {
  return `## Notion Commands

Read:
- notion list                        - List available skills
- notion read "<name>"               - Read skill instructions
- notion check "<name>"              - Show datasource schema from cache

Write:
- notion draft "<name>" "<content>"  - Create/update a draft skill (multiline compatible)
- notion show-draft "<name>"         - Show draft content for review
- notion commit "<name>"             - Move draft to active skills
- notion discard "<name>"            - Delete a draft

## Draft-Commit Workflow
1. Use "notion draft" to save your generated content
2. Show the draft to the user and ask for confirmation
3. Use "notion commit" to stage draft to active skills

## SKILL.md Format
Required: YAML frontmatter with "name" and "description"
Body: Freeform markdown with concise instructions for how to create entries`;
}

export type CommandHandler = (args: string) => string;

/**
 * Create notion command handlers for the command executor
 */
export function createNotionCommands(): Record<string, CommandHandler> {
  const findSkill = (name: string) => {
    const skills = scanSkills();
    return skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
  };

  const listAvailable = () => scanSkills().map((s) => s.name).join(', ') || 'none';

  return {
    'notion list': () => {
      const skills = scanSkills();
      return skills.length ? skills.map((s) => s.name).join('\n') : 'No skills available.';
    },

    'notion read': (name) => {
      if (!name) return 'Error: Usage: notion read <name>';

      const skill = findSkill(name);
      if (!skill) return `Error: Skill "${name}" not found. Available: ${listAvailable()}`;

      // Use the skill name from metadata (which matches the directory name)
      const skillPath = path.join(getDatasourcesBase(), skill.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        return `Error: Skill file not found for "${name}".`;
      }

      const raw = fs.readFileSync(skillPath, 'utf-8');
      return matter(raw).content.trim();
    },

    'notion help': () => {
      return getNotionHelp();
    },

    'notion draft': (args) => {
      if (!args) return 'Error: Usage: notion draft "<name>" "<content>"';

      const parsed = parseDraftArgs(args);
      if (!parsed) {
        return 'Error: Usage: notion draft "<name>" "<content>". Both name and content must be quoted.';
      }

      const [name, content] = parsed;
      const result = draftSkill(name, content);
      return result.message;
    },

    'notion show-draft': (name) => {
      if (!name) return 'Error: Usage: notion show-draft "<name>"';

      const content = readDraft(name);
      if (!content) return `Error: No draft found for "${name}".`;

      return content;
    },

    'notion commit': (name) => {
      if (!name) return 'Error: Usage: notion commit "<name>"';

      const result = commitSkill(name);
      return result.message;
    },

    'notion discard': (name) => {
      if (!name) return 'Error: Usage: notion discard "<name>"';

      const result = discardDraft(name);
      return result.message;
    },

    'notion check': (name) => {
      if (!name) return 'Error: Usage: notion check "<name>"';

      const schema = getDatasourceSchema(name);
      if (!schema) return `Error: No cached datasource found for "${name}". Use search_datasource first.`;

      return schema;
    },
  };
}
