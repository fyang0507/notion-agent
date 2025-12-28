import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';

const OUTPUT_PATH = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'notion_datasources.toml');

export interface DatasourceProperty {
  type: string;
  options?: string[];
}

export interface Datasource {
  name: string;
  id: string;
  properties: Record<string, DatasourceProperty>;
}

interface DatasourcesFile {
  datasources: Datasource[];
}

export function readDatasources(): Datasource[] {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return [];
  }
  const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
  const data = TOML.parse(content) as unknown as DatasourcesFile;
  return data.datasources || [];
}

export function saveDatasource(datasource: Datasource): { success: boolean; message: string } {
  // Ensure directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Read existing or create new
  let data: DatasourcesFile = { datasources: [] };
  if (fs.existsSync(OUTPUT_PATH)) {
    const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    data = TOML.parse(content) as unknown as DatasourcesFile;
  }

  // Check for duplicate by ID
  const existingIndex = data.datasources.findIndex((d) => d.id === datasource.id);
  if (existingIndex >= 0) {
    // Update existing
    data.datasources[existingIndex] = datasource;
    fs.writeFileSync(OUTPUT_PATH, TOML.stringify(data as unknown as TOML.JsonMap));
    return { success: true, message: `Updated existing datasource: ${datasource.name}` };
  }

  // Append new entry
  data.datasources.push(datasource);
  fs.writeFileSync(OUTPUT_PATH, TOML.stringify(data as unknown as TOML.JsonMap));
  return { success: true, message: `Saved new datasource: ${datasource.name}` };
}

export function getDatasourceById(id: string): Datasource | undefined {
  const datasources = readDatasources();
  return datasources.find((d) => d.id === id);
}

export interface CacheCheckResult {
  isCached: boolean;
  datasource?: Datasource;
  message: string;
}

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
