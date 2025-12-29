import 'dotenv/config';
import { ToolLoopAgent } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as readline from 'readline';
import { searchDatasource } from './tools/search-datasource.js';
import { createPage } from './tools/create-page.js';
import { getSkillList, createSkillCommands } from './skills/index.js';
import { createCommandExecutor } from './utils/shell-executor.js';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});

sdk.start();

const executeCommand = createCommandExecutor({
  ...createSkillCommands(),
});

const skillList = getSkillList();

const notionAgent = new ToolLoopAgent({
  model: "openai/gpt-5.1",
  instructions: `You are a Notion assistant that helps users discover, catalog, and create pages in their databases.

${skillList}

## Skill Commands
Before creating a page in a database, check the creation rules in different skill files. Use the shell tool to read it.

- skill list              - List available skills
- skill read <name>       - Read skill instructions
- skill help              - Show all commands (read, write, workflow)

When the user wants to find a database:
1. Use the search_datasource tool to search by name
2. If single match: schema will be auto-saved to local cache
3. If multiple matches: present the options to the user
4. After successful search, check if a skill exists via "skill read <name>"
5. If no skill exists, ask the user: "Would you like to create a skill for [name]?"

When the user wants to create a page:
1. First ensure the datasource is cached (use search_datasource if needed)
2. If a skill exists for this datasource, read it first to understand field requirements
3. Use create_page with properties in Notion API format
4. If the API returns an error, read the error message, adjust the format, and retry

Properties must be in Notion API format. Example:
{
  "Name": { "title": [{ "text": { "content": "My Title" } }] },
  "Tags": { "multi_select": [{ "name": "Tag1" }] },
  "Date": { "date": { "start": "2024-01-15" } }
}

Note: If you need to create or edit skills, or if create_page fails with a schema error, use "skill help" for available write commands.`,
  tools: {
    shell: openai.tools.shell({
      execute: async ({ action }) => {
        const results = action.commands.map((command: string) => {
          const output = executeCommand(command);
          const isError = output.startsWith('Error:');
          return {
            stdout: isError ? '' : output,
            stderr: isError ? output : '',
            outcome: { type: 'exit' as const, exitCode: isError ? 1 : 0 },
          };
        });
        return { output: results };
      },
    }),
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

  const prompt = (query: string): Promise<string> => new Promise((resolve) => rl.question(query, resolve));

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
