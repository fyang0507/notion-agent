import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';

const SCHEMAS_PATH = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'notion-schemas.toml');

export interface PropertySchema {
  name: string;
  type: string;
  options?: string[]; // For select/multi-select properties
}

export interface DatabaseSchema {
  database_id: string;
  name: string;
  last_fetched: string; // ISO date string
  properties: PropertySchema[];
}

interface SchemasFile {
  databases: DatabaseSchema[];
}

function ensureDirectory(): void {
  const dir = path.dirname(SCHEMAS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readSchemasFile(): SchemasFile {
  if (!fs.existsSync(SCHEMAS_PATH)) {
    return { databases: [] };
  }
  const content = fs.readFileSync(SCHEMAS_PATH, 'utf-8');
  return TOML.parse(content) as unknown as SchemasFile;
}

function writeSchemasFile(data: SchemasFile): void {
  ensureDirectory();
  fs.writeFileSync(SCHEMAS_PATH, TOML.stringify(data as unknown as TOML.JsonMap));
}

export function saveSchema(schema: DatabaseSchema): { success: boolean; message: string } {
  const data = readSchemasFile();

  // Find existing schema by database_id
  const existingIndex = data.databases.findIndex(
    (db) => db.database_id === schema.database_id
  );

  if (existingIndex >= 0) {
    // Update existing
    data.databases[existingIndex] = schema;
  } else {
    // Add new
    data.databases.push(schema);
  }

  writeSchemasFile(data);

  return {
    success: true,
    message: `Schema for "${schema.name}" (${schema.database_id}) saved successfully.`,
  };
}

export function loadSchema(databaseId: string): { found: boolean; schema?: DatabaseSchema; message: string } {
  const data = readSchemasFile();

  const schema = data.databases.find((db) => db.database_id === databaseId);

  if (schema) {
    return {
      found: true,
      schema,
      message: `Found cached schema for "${schema.name}" (last fetched: ${schema.last_fetched}).`,
    };
  }

  return {
    found: false,
    message: `No cached schema found for database ${databaseId}. Use notion_fetch to retrieve it.`,
  };
}

export function loadSchemaByName(name: string): { found: boolean; schema?: DatabaseSchema; message: string } {
  const data = readSchemasFile();

  const normalizedInput = name.toLowerCase().trim();
  const schema = data.databases.find(
    (db) => db.name.toLowerCase().trim().includes(normalizedInput)
  );

  if (schema) {
    return {
      found: true,
      schema,
      message: `Found cached schema for "${schema.name}" (last fetched: ${schema.last_fetched}).`,
    };
  }

  return {
    found: false,
    message: `No cached schema found for database matching "${name}". Use notion_fetch to retrieve it.`,
  };
}

export function listSchemas(): { schemas: DatabaseSchema[]; message: string } {
  const data = readSchemasFile();

  if (data.databases.length === 0) {
    return {
      schemas: [],
      message: 'No schemas cached yet.',
    };
  }

  return {
    schemas: data.databases,
    message: `Found ${data.databases.length} cached schema(s).`,
  };
}
