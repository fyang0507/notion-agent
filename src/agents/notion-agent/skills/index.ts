import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

const SKILLS_DIR = path.join(import.meta.dirname, '.');

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
    if (!entry.isDirectory() || entry.name === '_template') {
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
  };
}
