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

### Read Commands
- skill list              - List all available skills
- skill read <name>       - Read skill instructions (required/optional fields, defaults)
- skill info <name>       - Show skill metadata (name, description)

### Write Commands
- skill draft "<name>" "<content>"  - Create a draft skill (validates frontmatter)
- skill show-draft "<name>"         - Show draft content for review
- skill commit "<name>"             - Move draft to active skills
- skill discard "<name>"            - Delete a draft
- skill check "<name>"              - Show datasource schema from cache for reference

When the user wants to find a database:
1. Use the search_datasource tool to search by name
2. If single match: schema will be auto-saved to local cache
3. If multiple matches: present the options to the user (note that in case of multiple matches, schemas will not be saved)
4. After successful search, check if a skill exists via "skill info <name>"
5. If no skill exists, ask the user: "Would you like to create a skill for [name]?"

The saved metadata includes:
- Database name and ID
- All properties with their types
- Available options for status, select, and multi_select properties

Note: Cached metadata may become outdated. If you observe errors in other operations (e.g. schema error when creating a page), use forceRefresh: true to refresh the local cache.

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

## Schema Error Recovery
If create_page fails with a schema error (e.g., invalid option value):
1. Call search_datasource with forceRefresh: true to update the cache
2. Use "skill check <name>" to view the updated schema
3. Identify what changed and ask the user how to update the skill instructions
4. Update the skill using the draft-commit workflow below

## Skill Creation Flow
When creating or updating a skill:
1. Ask for description: "What is this database used for?"
2. Ask for content: "What instructions should I follow when creating entries?"
3. If the user's input seems incomplete (e.g., missing guidance for key fields), ask clarifying questions
4. Generate a SKILL.md file with the user's instructions

SKILL.md format:
- Required: YAML frontmatter with "name" and "description"
- Body: Freeform markdown with instructions for how to create entries

## Draft-Commit Workflow
IMPORTANT: When creating or updating skills:
1. Use "skill draft" to save your generated content
2. Show the draft content to the user and ask for confirmation
3. Only call "skill commit" after user explicitly approves
4. If user requests changes, update the draft and show again
5. Use "skill discard" if the user cancels`,
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
