/**
 * Datasource storage using agent-fs abstraction
 * Works both locally (filesystem) and on Vercel (GitHub API)
 */

import * as TOML from '@iarna/toml';
import { agentFS } from '../../../lib/agent-fs';

// Relative paths within AGENT_WORKING_FOLDER
const DATASOURCES_BASE = 'notion/datasources';

export interface DatasourceProperty {
  type: string;
  options?: string[];
}

export interface Datasource {
  name: string;
  id: string;
  properties: Record<string, DatasourceProperty>;
}

/**
 * Get the relative directory path for a specific datasource
 */
export function getDatasourcePath(name: string): string {
  return `${DATASOURCES_BASE}/${name}`;
}

/**
 * Get the relative schema.toml path for a specific datasource
 */
function getSchemaPath(name: string): string {
  return `${getDatasourcePath(name)}/schema.toml`;
}

/**
 * Get the relative SKILL.md path for a specific datasource
 */
export function getSkillPath(name: string): string {
  return `${getDatasourcePath(name)}/SKILL.md`;
}

/**
 * Get the relative drafts directory path
 */
export function getDraftsDir(): string {
  return `${DATASOURCES_BASE}/_drafts`;
}

/**
 * Read a single datasource schema from its directory
 */
async function readDatasourceSchema(name: string): Promise<Datasource | null> {
  const fs = agentFS();
  const schemaPath = getSchemaPath(name);
  const content = await fs.readFile(schemaPath);

  if (!content) {
    return null;
  }

  try {
    const data = TOML.parse(content) as unknown as Datasource;
    return data;
  } catch {
    return null;
  }
}

/**
 * Read all datasources from the directory structure
 */
export async function readDatasources(): Promise<Datasource[]> {
  const fs = agentFS();
  const entries = await fs.readDir(DATASOURCES_BASE);
  const datasources: Datasource[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory || entry.name === '_drafts') {
      continue;
    }

    const datasource = await readDatasourceSchema(entry.name);
    if (datasource) {
      datasources.push(datasource);
    }
  }

  return datasources;
}

/**
 * Save a datasource schema to its own directory
 */
export async function saveDatasource(datasource: Datasource): Promise<{ success: boolean; message: string }> {
  const fs = agentFS();
  const schemaPath = getSchemaPath(datasource.name);

  // Check if updating existing or creating new
  const isUpdate = await fs.exists(schemaPath);

  // Write schema.toml (agent-fs handles GitHub sync automatically on Vercel)
  const content = TOML.stringify(datasource as unknown as TOML.JsonMap);
  await fs.writeFile(schemaPath, content);

  return {
    success: true,
    message: isUpdate ? `Updated existing datasource: ${datasource.name}` : `Saved new datasource: ${datasource.name}`,
  };
}

/**
 * Get a datasource by ID
 */
export async function getDatasourceById(id: string): Promise<Datasource | undefined> {
  const datasources = await readDatasources();
  return datasources.find((d) => d.id === id);
}

/**
 * Get a datasource by name (case-insensitive)
 */
export async function getDatasourceByName(name: string): Promise<Datasource | undefined> {
  const datasources = await readDatasources();
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
export async function checkCachedDatasource(name: string): Promise<CacheCheckResult> {
  const datasources = await readDatasources();

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
export async function listDatasourceNames(): Promise<string[]> {
  const fs = agentFS();
  const entries = await fs.readDir(DATASOURCES_BASE);

  return entries.filter((entry) => entry.isDirectory && entry.name !== '_drafts').map((entry) => entry.name);
}
