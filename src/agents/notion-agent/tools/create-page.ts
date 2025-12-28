import { tool } from 'ai';
import { z } from 'zod';
import { Client } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { readDatasources, type Datasource } from '../utils/datasource-toml.js';

function findDatasourceByName(name: string): Datasource | undefined {
  const datasources = readDatasources();
  const normalizedInput = name.toLowerCase().trim();
  return datasources.find((d) => d.name.toLowerCase().trim() === normalizedInput);
}

export const createPage = tool({
  description:
    'Create a new page in a Notion datasource (database). Properties and children are passed directly to the Notion API. If the API returns an error, adjust the format and retry.',
  inputSchema: z.object({
    datasourceName: z.string().describe('Name of the cached datasource to create the page under'),
    properties: z
      .record(z.string(), z.unknown())
      .describe('Properties object in Notion API format. Example: { "Name": { "title": [{ "text": { "content": "Page title" } }] } }'),
    children: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .default([])
      .describe('Optional array of block objects in Notion API format for page content'),
  }),
  execute: async ({
    datasourceName,
    properties,
    children = [],
  }: {
    datasourceName: string;
    properties: Record<string, unknown>;
    children?: Record<string, unknown>[];
  }) => {
    // Find the datasource
    const datasource = findDatasourceByName(datasourceName);
    if (!datasource) {
      return {
        success: false,
        message: `Datasource "${datasourceName}" not found in cache. Use search_datasource tool first to discover and cache it.`,
      };
    }

    if (!process.env.NOTION_TOKEN) {
      return {
        success: false,
        message: 'NOTION_TOKEN is not set in environment',
      };
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    try {
      const response = await notion.pages.create({
        parent: {
          type: 'data_source_id',
          data_source_id: datasource.id,
        },
        properties: properties as CreatePageParameters['properties'],
        children: children.length > 0 ? (children as CreatePageParameters['children']) : undefined,
      });

      return {
        success: true,
        message: `Page created successfully in "${datasource.name}"`,
        pageId: response.id,
        url: 'url' in response ? response.url : undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create page: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
