import { tool, generateText, Output } from 'ai';
import { z } from 'zod';
import { Client } from '@notionhq/client';
import type { DataSourceObjectResponse, GetDataSourceResponse } from '@notionhq/client/build/src/api-endpoints';
import { saveDatasource, checkCachedDatasource, type Datasource } from '../utils/datasource-toml.js';

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
  description:
    'Search for a Notion database by name and save its metadata (schema, property options) to a local file for later use in building filters.',
  inputSchema: z.object({
    query: z.string().describe('Name of the database to search for'),
    autoSave: z
      .boolean()
      .optional()
      .default(true)
      .describe('Automatically save if only one match is found'),
  }),
  execute: async ({ query, autoSave = true }: { query: string; autoSave?: boolean }) => {
    // Check cache first
    const cacheResult = checkCachedDatasource(query);
    if (cacheResult.isCached && cacheResult.datasource) {
      return {
        success: true,
        message: cacheResult.message,
        databases: [cacheResult.datasource],
        fromCache: true,
      };
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

    // Auto-save if single match - use LLM extraction
    if (autoSave && dataSources.length === 1) {
      const datasource = await extractDatasourceWithLLM(dataSources[0]);
      const result = saveDatasource(datasource);
      return {
        success: true,
        message: result.message,
        databases: [datasource],
        saved: datasource.name,
      };
    }

    // Multiple matches - return summary without full LLM extraction
    return {
      success: true,
      message: `Found ${dataSources.length} database(s) matching "${query}". Use save_datasource to save one.`,
      databases: dataSources.map((ds) => ({
        name: ds.title.map((t) => t.plain_text).join('') || '(Untitled)',
        id: ds.id,
        propertyCount: Object.keys(ds.properties).length,
      })),
    };
  },
});

export const saveDatasourceTool = tool({
  description: 'Save a specific database metadata to the local file after searching.',
  inputSchema: z.object({
    databaseId: z.string().describe('The ID of the database to save'),
  }),
  execute: async ({ databaseId }: { databaseId: string }) => {
    if (!process.env.NOTION_TOKEN) {
      return {
        success: false,
        message: 'NOTION_TOKEN is not set in environment',
      };
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    try {
      const response: GetDataSourceResponse = await notion.dataSources.retrieve({
        data_source_id: databaseId,
      });

      // GetDataSourceResponse can be partial or full
      if (!('properties' in response)) {
        return {
          success: false,
          message: 'Retrieved a partial data source response without properties',
        };
      }

      const datasource = await extractDatasourceWithLLM(response as DataSourceObjectResponse);
      const result = saveDatasource(datasource);

      return {
        success: true,
        message: result.message,
        saved: datasource,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to retrieve database: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
