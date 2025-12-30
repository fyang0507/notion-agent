import { tool, generateText, Output } from 'ai';
import { z } from 'zod';
import { Client } from '@notionhq/client';
import type { DataSourceObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { saveDatasource, checkCachedDatasource, type Datasource } from '../utils/datasource-store.js';

// Schema for LLM-extracted datasource metadata
const DatasourceSchema = z.object({
  name: z.string().describe('The database name/title'),
  properties: z.record(
    z.string(),
    z.object({
      type: z.string().describe('The property type (e.g., status, select, multi_select, date, title, rich_text, etc.)'),
      options: z
        .array(z.string())
        .optional()
        .describe('Available options for status, select, or multi_select properties'),
    })
  ),
});

async function extractDatasourceWithLLM(rawData: DataSourceObjectResponse): Promise<Datasource> {
  const { output } = await generateText({
    model: 'deepseek/deepseek-v3.2',
    output: Output.object({ schema: DatasourceSchema }),
    prompt: `Extract the database metadata from the following Notion database response.

For each property:
- Extract the type
- For properties with different options (e.g. Status, Tags), extract all available option names

Raw database data:
${JSON.stringify(rawData, null, 2)}`,
    experimental_telemetry: { isEnabled: true },
  });

  if (!output) {
    throw new Error('LLM failed to extract datasource metadata');
  }

  return {
    name: output.name || '(Untitled)',
    id: rawData.id,
    properties: output.properties,
  };
}

export const searchDatasource = tool({
  description: `Search for a Notion database by name and save its metadata (schema, property options) to local cache.
Workflow: check local cache first → if not found → query Notion API → auto-save results.
Note: Local cache may become outdated. If you encounter schema errors in later operations, use forceRefresh: true to fetch the latest schema from Notion.`,
  inputSchema: z.object({
    query: z.string().describe('Name of the database to search for'),
    forceRefresh: z
      .boolean()
      .optional()
      .default(false)
      .describe('Bypass local cache and fetch fresh data from Notion API'),
  }),
  execute: async ({
    query,
    forceRefresh = false,
  }: {
    query: string;
    forceRefresh?: boolean;
  }) => {
    // Check cache first (unless forceRefresh is true)
    if (!forceRefresh) {
      const cacheResult = checkCachedDatasource(query);
      if (cacheResult.isCached && cacheResult.datasource) {
        return {
          success: true,
          message: cacheResult.message,
          databases: [cacheResult.datasource],
          fromCache: true,
        };
      }
    }

    if (!process.env.NOTION_TOKEN) {
      return {
        success: false,
        message: 'NOTION_TOKEN is not set in environment',
        databases: [] as Datasource[],
      };
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    const response = await notion.search({
      query,
      filter: {
        value: 'data_source',
        property: 'object',
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time',
      },
    });

    const dataSources = response.results.filter(
      (r): r is DataSourceObjectResponse => r.object === 'data_source'
    );

    if (dataSources.length === 0) {
      return {
        success: false,
        message: `No databases found matching "${query}"`,
        databases: [] as Datasource[],
      };
    }

    // Extract and save all matches
    const savedDatasources: Datasource[] = [];
    for (const ds of dataSources) {
      const datasource = await extractDatasourceWithLLM(ds);
      saveDatasource(datasource);
      savedDatasources.push(datasource);
    }

    return {
      success: true,
      message: `Found and saved ${savedDatasources.length} database(s) matching "${query}"`,
      databases: savedDatasources,
    };
  },
});

