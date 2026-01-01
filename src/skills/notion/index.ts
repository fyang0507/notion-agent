import matter from 'gray-matter';
import {
  getSkillPath,
  getDraftsDir,
  getDatasourceByName,
  listDatasourceNames,
} from './utils/datasource-store';
import { agentFS } from '../../lib/agent-fs';

export interface SkillMetadata {
  name: string;
  description: string;
}

/**
 * Scan the datasources directory and return metadata for all skills
 */
export async function scanSkills(): Promise<SkillMetadata[]> {
  const fs = agentFS();
  const datasourceNames = await listDatasourceNames();
  const skills: SkillMetadata[] = [];

  for (const name of datasourceNames) {
    const skillPath = getSkillPath(name);
    const raw = await fs.readFile(skillPath);

    if (!raw) continue;

    try {
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
export async function getSkillList(): Promise<string> {
  const skills = await scanSkills();

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
export async function draftSkill(name: string, content: string): Promise<SkillWriteResult> {
  const validation = validateSkillContent(content);
  if (!validation.valid) {
    return { success: false, message: `Error: ${validation.error}` };
  }

  const fs = agentFS();
  const draftPath = `${getDraftsDir()}/${name}/SKILL.md`;
  await fs.writeFile(draftPath, content);

  return { success: true, message: `Draft saved for "${name}". Use 'notion show-draft "${name}"' to review.` };
}

/**
 * Commit a draft skill to the datasource directory
 */
export async function commitSkill(name: string): Promise<SkillWriteResult> {
  const fs = agentFS();
  const draftFile = `${getDraftsDir()}/${name}/SKILL.md`;

  const content = await fs.readFile(draftFile);
  if (!content) {
    return { success: false, message: `Error: No draft found for "${name}". Use 'notion draft' first.` };
  }

  const targetFile = getSkillPath(name);

  // Write to active location (agent-fs handles GitHub sync on Vercel)
  await fs.writeFile(targetFile, content);

  // Remove draft
  await fs.remove(`${getDraftsDir()}/${name}`);

  return { success: true, message: `Skill "${name}" committed successfully.` };
}

/**
 * Discard a draft skill
 */
export async function discardDraft(name: string): Promise<SkillWriteResult> {
  const fs = agentFS();
  const draftPath = `${getDraftsDir()}/${name}`;

  const exists = await fs.exists(draftPath);
  if (!exists) {
    return { success: false, message: `Error: No draft found for "${name}".` };
  }

  await fs.remove(draftPath);
  return { success: true, message: `Draft "${name}" discarded.` };
}

/**
 * Read a draft skill's content
 */
export async function readDraft(name: string): Promise<string | null> {
  const fs = agentFS();
  const draftFile = `${getDraftsDir()}/${name}/SKILL.md`;
  return fs.readFile(draftFile);
}

/**
 * Get datasource schema for a given name
 */
export async function getDatasourceSchema(name: string): Promise<string | null> {
  const datasource = await getDatasourceByName(name);

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

export type CommandHandler = (args: string) => string | Promise<string>;

/**
 * Create notion command handlers for the command executor
 */
export function createNotionCommands(): Record<string, CommandHandler> {
  const findSkill = async (name: string) => {
    const skills = await scanSkills();
    return skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
  };

  const listAvailable = async () => {
    const skills = await scanSkills();
    return skills.map((s) => s.name).join(', ') || 'none';
  };

  return {
    'notion list': async () => {
      const skills = await scanSkills();
      return skills.length ? skills.map((s) => s.name).join('\n') : 'No skills available.';
    },

    'notion read': async (name) => {
      if (!name) return 'Error: Usage: notion read <name>';

      const skill = await findSkill(name);
      if (!skill) return `Error: Skill "${name}" not found. Available: ${await listAvailable()}`;

      const fs = agentFS();
      const skillPath = getSkillPath(skill.name);
      const raw = await fs.readFile(skillPath);

      if (!raw) {
        return `Error: Skill file not found for "${name}".`;
      }

      return matter(raw).content.trim();
    },

    'notion help': () => {
      return getNotionHelp();
    },

    'notion draft': async (args) => {
      if (!args) return 'Error: Usage: notion draft "<name>" "<content>"';

      const parsed = parseDraftArgs(args);
      if (!parsed) {
        return 'Error: Usage: notion draft "<name>" "<content>". Both name and content must be quoted.';
      }

      const [name, content] = parsed;
      const result = await draftSkill(name, content);
      return result.message;
    },

    'notion show-draft': async (name) => {
      if (!name) return 'Error: Usage: notion show-draft "<name>"';

      const content = await readDraft(name);
      if (!content) return `Error: No draft found for "${name}".`;

      return content;
    },

    'notion commit': async (name) => {
      if (!name) return 'Error: Usage: notion commit "<name>"';

      const result = await commitSkill(name);
      return result.message;
    },

    'notion discard': async (name) => {
      if (!name) return 'Error: Usage: notion discard "<name>"';

      const result = await discardDraft(name);
      return result.message;
    },

    'notion check': async (name) => {
      if (!name) return 'Error: Usage: notion check "<name>"';

      const schema = await getDatasourceSchema(name);
      if (!schema) return `Error: No cached datasource found for "${name}". Use search_datasource first.`;

      return schema;
    },
  };
}
