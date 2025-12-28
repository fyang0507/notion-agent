import 'dotenv/config';
import { ToolLoopAgent } from 'ai';
import * as readline from 'readline';
import { searchDatasource, saveDatasourceTool } from './tools/search-datasource.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

const notionAgent = new ToolLoopAgent({
  model: 'google/gemini-3-flash',
  instructions: `You are a Notion assistant that helps users discover and catalog their databases.

When the user wants to find a database:
1. Use the search_datasource tool to search by name
2. If single match: it will be auto-saved
3. If multiple matches: present the options and ask the user which one to save
4. Use save_datasource tool to save a specific database by ID

The saved metadata includes:
- Database name and ID
- All properties with their types
- Available options for status, select, and multi_select properties

This metadata can be used later to build query filters.`,
  tools: {
    search_datasource: searchDatasource,
    save_datasource: saveDatasourceTool,
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
