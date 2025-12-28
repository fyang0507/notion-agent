import 'dotenv/config';
import { ToolLoopAgent } from 'ai';
import * as readline from 'readline';
import { searchDatasource } from './tools/search-datasource.js';
import { createPage } from './tools/create-page.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

const notionAgent = new ToolLoopAgent({
  model: 'google/gemini-3-flash',
  instructions: `You are a Notion assistant that helps users discover, catalog, and create pages in their databases.

When the user wants to find a database:
1. Use the search_datasource tool to search by name
2. If single match: schema will be auto-saved to local cache
3. If multiple matches: present the options to the user (note that in case of multiple matches, schemas will not be saved)

The saved metadata includes:
- Database name and ID
- All properties with their types
- Available options for status, select, and multi_select properties

Note: Cached metadata may become outdated. If you observe errors in other operations (e.g. schema error when creating a page), use forceRefresh: true to refresh the local cache.

When the user wants to create a page:
1. First ensure the datasource is cached (use search_datasource if needed)
2. Use create_page with properties in Notion API format
3. If the API returns an error, read the error message, adjust the format, and retry

Properties must be in Notion API format. Example:
{
  "Name": { "title": [{ "text": { "content": "My Title" } }] },
  "Tags": { "multi_select": [{ "name": "Tag1" }] },
  "Date": { "date": { "start": "2024-01-15" } }
}`,
  tools: {
    search_datasource: searchDatasource,
    create_page: createPage,
  },
  experimental_telemetry: { isEnabled: true },
});

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  console.log('Notion Agent');

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  while (true) {
    const userInput = await prompt('You: ');
    if (userInput.toLowerCase() === 'quit') break;

    messages.push({ role: 'user', content: userInput });

    process.stdout.write('\nAssistant: ');

    try {
      const result = await notionAgent.stream({
        messages,
      });

      let fullText = '';
      for await (const chunk of result.textStream) {
        process.stdout.write(chunk);
        fullText += chunk;
      }

      console.log('\n');

      messages.push({ role: 'assistant', content: fullText });
    } catch (error) {
      console.error('\n[ERROR]:', error);
    }
  }

  rl.close();
}

main();
