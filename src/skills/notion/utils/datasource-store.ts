import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';

// New base path for all notion datasources
const DATASOURCES_BASE = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'notion', 'datasources');

// Old paths for migration
const OLD_TOML_PATH = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'notion_datasources.toml');
const OLD_SKILLS_DIR = path.join(process.cwd(), 'src', 'agents', 'notion-agent', 'skills');

export interface DatasourceProperty {
  type: string;
  options?: string[];
}

export interface Datasource {
  name: string;
  id: string;
  properties: Record<string, DatasourceProperty>;
}

interface OldDatasourcesFile {
  datasources: Datasource[];
}

/**
 * Ensure the datasources base directory exists
 */
function ensureBaseDir(): void {
  if (!fs.existsSync(DATASOURCES_BASE)) {
    fs.mkdirSync(DATASOURCES_BASE, { recursive: true });
  }
}

/**
 * Get the directory path for a specific datasource
 */
export function getDatasourcePath(name: string): string {
  return path.join(DATASOURCES_BASE, name);
}

/**
 * Get the schema.toml path for a specific datasource
 */
function getSchemaPath(name: string): string {
  return path.join(getDatasourcePath(name), 'schema.toml');
}

/**
 * Get the SKILL.md path for a specific datasource
 */
export function getSkillPath(name: string): string {
  return path.join(getDatasourcePath(name), 'SKILL.md');
}

/**
 * Get the drafts directory path
 */
export function getDraftsDir(): string {
  return path.join(DATASOURCES_BASE, '_drafts');
}

/**
 * Read a single datasource schema from its directory
 */
function readDatasourceSchema(name: string): Datasource | null {
  const schemaPath = getSchemaPath(name);
  if (!fs.existsSync(schemaPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const data = TOML.parse(content) as unknown as Datasource;
    return data;
  } catch {
    return null;
  }
}

/**
 * Read all datasources from the new directory structure
 */
export function readDatasources(): Datasource[] {
  // Run migration if needed
  migrateIfNeeded();

  if (!fs.existsSync(DATASOURCES_BASE)) {
    return [];
  }

  const entries = fs.readdirSync(DATASOURCES_BASE, { withFileTypes: true });
  const datasources: Datasource[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_drafts') {
      continue;
    }

    const datasource = readDatasourceSchema(entry.name);
    if (datasource) {
      datasources.push(datasource);
    }
  }

  return datasources;
}

/**
 * Save a datasource schema to its own directory
 */
export function saveDatasource(datasource: Datasource): { success: boolean; message: string } {
  ensureBaseDir();

  const datasourcePath = getDatasourcePath(datasource.name);
  const schemaPath = getSchemaPath(datasource.name);

  // Create datasource directory if needed
  if (!fs.existsSync(datasourcePath)) {
    fs.mkdirSync(datasourcePath, { recursive: true });
  }

  // Check if updating existing or creating new
  const isUpdate = fs.existsSync(schemaPath);

  // Write schema.toml
  fs.writeFileSync(schemaPath, TOML.stringify(datasource as unknown as TOML.JsonMap));

  return {
    success: true,
    message: isUpdate
      ? `Updated existing datasource: ${datasource.name}`
      : `Saved new datasource: ${datasource.name}`,
  };
}

/**
 * Get a datasource by ID
 */
export function getDatasourceById(id: string): Datasource | undefined {
  const datasources = readDatasources();
  return datasources.find((d) => d.id === id);
}

/**
 * Get a datasource by name (case-insensitive)
 */
export function getDatasourceByName(name: string): Datasource | undefined {
  const datasources = readDatasources();
  const normalizedInput = name.toLowerCase().trim();
  return datasources.find((d) => d.name.toLowerCase().trim() === normalizedInput);
}

export interface CacheCheckResult {
  isCached: boolean;
  datasource?: Datasource;
  message: string;
}

/**
 * Check if a datasource is cached by name
 */
export function checkCachedDatasource(name: string): CacheCheckResult {
  const datasources = readDatasources();

  if (datasources.length === 0) {
    return {
      isCached: false,
      message: 'No datasources cached yet. Will query Notion API.',
    };
  }

  const normalizedInput = name.toLowerCase().trim();
  const cached = datasources.find((d) => d.name.toLowerCase().trim() === normalizedInput);

  if (cached) {
    return {
      isCached: true,
      datasource: cached,
      message: `Found cached datasource "${cached.name}" (ID: ${cached.id}). No need to query Notion API.`,
    };
  }

  return {
    isCached: false,
    message: `No cached datasource found for "${name}". Will query Notion API.`,
  };
}

/**
 * List all datasource names
 */
export function listDatasourceNames(): string[] {
  if (!fs.existsSync(DATASOURCES_BASE)) {
    return [];
  }

  const entries = fs.readdirSync(DATASOURCES_BASE, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_drafts')
    .map((entry) => entry.name);
}

/**
 * Migration: Convert old structure to new structure
 */
function migrateIfNeeded(): void {
  // Check if migration is needed
  const oldTomlExists = fs.existsSync(OLD_TOML_PATH);
  const newStructureExists = fs.existsSync(DATASOURCES_BASE);

  // If new structure already exists and old doesn't, no migration needed
  if (newStructureExists && !oldTomlExists) {
    return;
  }

  // If old doesn't exist either, nothing to migrate
  if (!oldTomlExists) {
    return;
  }

  console.log('[Migration] Converting to new datasource directory structure...');

  // Ensure base directory exists
  ensureBaseDir();

  // Step 1: Parse old TOML and create per-datasource directories
  try {
    const oldContent = fs.readFileSync(OLD_TOML_PATH, 'utf-8');
    const oldData = TOML.parse(oldContent) as unknown as OldDatasourcesFile;

    if (oldData.datasources) {
      for (const datasource of oldData.datasources) {
        const datasourcePath = getDatasourcePath(datasource.name);
        const schemaPath = getSchemaPath(datasource.name);

        // Create directory
        if (!fs.existsSync(datasourcePath)) {
          fs.mkdirSync(datasourcePath, { recursive: true });
        }

        // Write schema.toml
        fs.writeFileSync(schemaPath, TOML.stringify(datasource as unknown as TOML.JsonMap));
        console.log(`[Migration] Created schema for: ${datasource.name}`);
      }
    }
  } catch (err) {
    console.error('[Migration] Error parsing old TOML:', err);
  }

  // Step 2: Move SKILL.md files from old skills directory
  if (fs.existsSync(OLD_SKILLS_DIR)) {
    const entries = fs.readdirSync(OLD_SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '_template' || entry.name === '_drafts') {
        continue;
      }

      const oldSkillPath = path.join(OLD_SKILLS_DIR, entry.name, 'SKILL.md');
      if (!fs.existsSync(oldSkillPath)) {
        continue;
      }

      const newDatasourcePath = getDatasourcePath(entry.name);
      const newSkillPath = getSkillPath(entry.name);

      // Create datasource directory if it doesn't exist (skill without schema)
      if (!fs.existsSync(newDatasourcePath)) {
        fs.mkdirSync(newDatasourcePath, { recursive: true });
      }

      // Copy SKILL.md to new location
      const skillContent = fs.readFileSync(oldSkillPath, 'utf-8');
      fs.writeFileSync(newSkillPath, skillContent);
      console.log(`[Migration] Moved skill: ${entry.name}`);

      // Remove old skill directory
      fs.rmSync(path.join(OLD_SKILLS_DIR, entry.name), { recursive: true });
    }
  }

  // Step 3: Cleanup old locations
  // Remove old TOML file
  fs.unlinkSync(OLD_TOML_PATH);
  console.log('[Migration] Removed old notion_datasources.toml');

  // Note: We don't remove _template as it may be useful for reference
  // The user can manually move it to MEMORY/ if desired

  console.log('[Migration] Migration complete!');
}

/**
 * Force migration (for testing)
 */
export function runMigration(): void {
  migrateIfNeeded();
}
