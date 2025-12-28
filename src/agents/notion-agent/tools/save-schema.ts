import { tool } from 'ai';
import { z } from 'zod';
import { saveSchema, type PropertySchema } from '../utils/schema-storage.js';

export const saveSchemaT = tool({
  description: `Save a Notion database schema to local cache. Call this after fetching a database schema with notion-fetch to cache it for future reference. This helps avoid repeated API calls and ensures consistent property names when creating pages.`,
  inputSchema: z.object({
    database_id: z.string().describe('The Notion database ID (UUID format)'),
    name: z.string().describe('The database name/title'),
    properties: z.array(
      z.object({
        name: z.string().describe('Property name'),
        type: z.string().describe('Property type (e.g., title, rich_text, select, multi_select, date, number, url, checkbox, etc.)'),
        options: z.array(z.string()).optional().describe('Available options for select/multi_select properties'),
      })
    ).describe('Array of property schemas'),
  }),
  execute: async ({
    database_id,
    name,
    properties,
  }: {
    database_id: string;
    name: string;
    properties: PropertySchema[];
  }) => {
    return saveSchema({
      database_id,
      name,
      last_fetched: new Date().toISOString(),
      properties,
    });
  },
});
