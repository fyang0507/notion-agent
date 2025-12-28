import { tool } from 'ai';
import { z } from 'zod';
import { loadSchema, loadSchemaByName, listSchemas } from '../utils/schema-storage.js';

export const loadSchemaT = tool({
  description: `Load a cached Notion database schema. Use this before writing to a database to ensure you use correct property names and types. Can search by database ID or name.`,
  inputSchema: z.object({
    database_id: z.string().optional().describe('The Notion database ID (UUID format) - provide either this or name'),
    name: z.string().optional().describe('The database name to search for (partial match) - provide either this or database_id'),
  }),
  execute: async ({
    database_id,
    name,
  }: {
    database_id?: string;
    name?: string;
  }) => {
    if (database_id) {
      return loadSchema(database_id);
    }

    if (name) {
      return loadSchemaByName(name);
    }

    // If neither provided, list all schemas
    return listSchemas();
  },
});
