import 'dotenv/config';
import { ToolLoopAgent } from 'ai';
import * as readline from 'readline';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { createNotionMCPClient } from './utils/mcp-client.js';
import { saveSchemaT } from './tools/save-schema.js';
import { loadSchemaT } from './tools/load-schema.js';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

const SYSTEM_INSTRUCTIONS = `You are a Notion assistant. Always respond in the same language the user speaks.

## Workflow Guidelines

### First-time Interaction with a Database
1. Search for the database by title
2. Retrieve the database to get its schema
3. Use save_schema to cache the schema locally for future use

### Before Creating Pages
1. Use load_schema to retrieve the cached schema
2. If not cached, fetch and cache it first
3. Ensure property names and types match the schema exactly

### Best Practices
- Always confirm with user before creating/modifying content
- Present search results clearly and ask user to confirm when multiple matches
- For queries with filters, explain what filters are being applied`;

async function main() {
  console.log('Starting Notion Agent...');
  console.log('Initializing MCP connection to Notion...\n');

  // Initialize MCP client
  const mcpClient = await createNotionMCPClient();

  // Get MCP tools
  const mcpTools = await mcpClient.tools();

  console.log('MCP Tools loaded:', Object.keys(mcpTools).join(', '));
  console.log('');

  // Define the Notion agent with combined tools
  const notionAgent = new ToolLoopAgent({
    model: 'google/gemini-3-flash',
    instructions: SYSTEM_INSTRUCTIONS,
    tools: {
      ...mcpTools,
      save_schema: saveSchemaT,
      load_schema: loadSchemaT,
    },
    experimental_telemetry: { isEnabled: true },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  console.log('Notion Agent');
  console.log('Type "quit" to exit.\n');

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  try {
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
  } finally {
    rl.close();
    await mcpClient.close();
    await sdk.shutdown();
  }
}

main().catch(console.error);
