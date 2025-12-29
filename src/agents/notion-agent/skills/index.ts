import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { readDatasources } from '../utils/datasource-toml.js';

const SKILLS_DIR = path.join(import.meta.dirname, '.');
const DRAFTS_DIR = path.join(SKILLS_DIR, '_drafts');

export interface SkillMetadata {
  name: string;
  description: string;
}

/**
 * Scan the skills directory and return metadata for all valid skills
 */
export function scanSkills(): SkillMetadata[] {
  if (!fs.existsSync(SKILLS_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_template' || entry.name === '_drafts') {
      continue;
    }

    const skillPath = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      continue;
    }

    const raw = fs.readFileSync(skillPath, 'utf-8');
    const { data } = matter(raw);

    if (data.name && data.description) {
      skills.push({
        name: data.name,
        description: data.description,
      });
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

  const lines = skills
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join('\n');

  return `## Available Skills\n${lines}`;
}

/**
 * Parse the first quoted argument and return the rest as a second argument.
 * Used for 'skill draft "name" "content"' where content may contain quotes.
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

  // Ensure _drafts directory exists
  if (!fs.existsSync(DRAFTS_DIR)) {
    fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  }

  const draftPath = path.join(DRAFTS_DIR, name);
  if (!fs.existsSync(draftPath)) {
    fs.mkdirSync(draftPath, { recursive: true });
  }

  const skillFile = path.join(draftPath, 'SKILL.md');
  fs.writeFileSync(skillFile, content, 'utf-8');

  return { success: true, message: `Draft saved for "${name}". Use 'skill show-draft "${name}"' to review.` };
}

/**
 * Commit a draft skill to the active skills directory
 */
export function commitSkill(name: string): SkillWriteResult {
  const draftPath = path.join(DRAFTS_DIR, name);
  const draftFile = path.join(draftPath, 'SKILL.md');

  if (!fs.existsSync(draftFile)) {
    return { success: false, message: `Error: No draft found for "${name}". Use 'skill draft' first.` };
  }

  const targetPath = path.join(SKILLS_DIR, name);
  const targetFile = path.join(targetPath, 'SKILL.md');

  // Create target directory if needed
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
  const draftPath = path.join(DRAFTS_DIR, name);

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
  const draftFile = path.join(DRAFTS_DIR, name, 'SKILL.md');
  if (!fs.existsSync(draftFile)) {
    return null;
  }
  return fs.readFileSync(draftFile, 'utf-8');
}

/**
 * Get datasource schema from cache for a given name
 */
export function getDatasourceSchema(name: string): string | null {
  const datasources = readDatasources();
  const normalizedInput = name.toLowerCase().trim();
  const datasource = datasources.find((d) => d.name.toLowerCase().trim() === normalizedInput);

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
 * Create skill command handlers for the command executor
 */
export function createSkillCommands(): Record<string, (args: string) => string> {
  const findSkill = (name: string) =>
    scanSkills().find((s) => s.name.toLowerCase() === name.toLowerCase());

  const listAvailable = () =>
    scanSkills().map((s) => s.name).join(', ') || 'none';

  return {
    'skill list': () => {
      const skills = scanSkills();
      return skills.length ? skills.map((s) => s.name).join('\n') : 'No skills available.';
    },

    'skill read': (name) => {
      if (!name) return 'Error: Usage: skill read <name>';

      const skill = findSkill(name);
      if (!skill) return `Error: Skill "${name}" not found. Available: ${listAvailable()}`;

      const skillPath = path.join(SKILLS_DIR, name, 'SKILL.md');
      const raw = fs.readFileSync(skillPath, 'utf-8');
      return matter(raw).content.trim();
    },

    'skill info': (name) => {
      if (!name) return 'Error: Usage: skill info <name>';

      const skill = findSkill(name);
      if (!skill) return `Error: Skill "${name}" not found. Available: ${listAvailable()}`;

      return `Name: ${skill.name}\nDescription: ${skill.description}`;
    },

    'skill draft': (args) => {
      if (!args) return 'Error: Usage: skill draft "<name>" "<content>"';

      const parsed = parseDraftArgs(args);
      if (!parsed) {
        return 'Error: Usage: skill draft "<name>" "<content>". Both name and content must be quoted.';
      }

      const [name, content] = parsed;
      const result = draftSkill(name, content);
      return result.message;
    },

    'skill show-draft': (name) => {
      if (!name) return 'Error: Usage: skill show-draft "<name>"';

      const content = readDraft(name);
      if (!content) return `Error: No draft found for "${name}".`;

      return content;
    },

    'skill commit': (name) => {
      if (!name) return 'Error: Usage: skill commit "<name>"';

      const result = commitSkill(name);
      return result.message;
    },

    'skill discard': (name) => {
      if (!name) return 'Error: Usage: skill discard "<name>"';

      const result = discardDraft(name);
      return result.message;
    },

    'skill check': (name) => {
      if (!name) return 'Error: Usage: skill check "<name>"';

      const schema = getDatasourceSchema(name);
      if (!schema) return `Error: No cached datasource found for "${name}". Use search_datasource first.`;

      return schema;
    },
  };
}
