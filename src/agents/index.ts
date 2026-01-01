import 'dotenv/config';
import { ToolLoopAgent } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import { searchDatasource } from '@/skills/notion/tools/search-datasource';
import { createPage } from '@/skills/notion/tools/create-page';
import { getSkillList, createNotionCommands } from '@/skills/notion/index';
import { createPodcastCommands } from '@/skills/podcast/index';
import { createCommandExecutor } from './utils/shell-executor';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

interface AgentOptions {
  /** Session ID for grouping conversation traces in Langfuse */
  traceId?: string;
}

/**
 * Factory function for creating the unified agent.
 * Used by both web (imported) and CLI (direct execution).
 */
export function createUnifiedAgent(options?: AgentOptions) {
  const executeCommand = createCommandExecutor({
    ...createNotionCommands(),
    ...createPodcastCommands(),
  });

  const skillList = getSkillList();

  return new ToolLoopAgent({
    model: 'openai/gpt-5.1',
    instructions: `You are a personal assistant that helps users with Notion operations and podcast discovery. Always respond in the same language the user speaks.

${skillList}

## Available Domains
- notion help   - Notion database operations
- podcast help  - Podcast discovery and management

## Notion Commands
Before creating a page in a database, check the creation rules in different skill files. Use the shell tool to read it.

- notion list              - List available skills
- notion read <name>       - Read skill instructions
- notion help              - Show all commands (read, write, workflow)

When the user wants to find a database:
1. Use the search_datasource tool to search by name
2. If single match: schema will be auto-saved to local cache
3. If multiple matches: present the options to the user
4. After successful search, check if a skill exists via "notion read <name>"
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

Note: If you need to create or edit skills, or if create_page fails with a schema error, use "notion help" for available write commands.

## Podcast Commands
When the user provides a podcast name to save:
1. FIRST: Use "podcast check <name>" to check if already saved
2. If duplicate found: Inform the user and stop
3. If no duplicate: Use "podcast search <query>" to find matching podcasts
4. If no results: Ask user to verify the podcast name
5. If multiple results: Present numbered options and ask user to pick one
6. Once user confirms: Use "podcast save <name> <url>" to save it

When the user asks for podcast recommendations:
- Use "podcast recommend" to fetch and rank recent episodes
- Present the recommendations clearly with titles, podcast names, and reasons`,
    tools: {
      shell: openai.tools.shell({
        execute: async ({ action }) => {
          const results = await Promise.all(
            action.commands.map(async (command: string) => {
              const output = await executeCommand(command);
              const isError = output.startsWith('Error:');
              return {
                stdout: isError ? '' : output,
                stderr: isError ? output : '',
                outcome: { type: 'exit' as const, exitCode: isError ? 1 : 0 },
              };
            })
          );
          return { output: results };
        },
      }),
      search_datasource: searchDatasource,
      create_page: createPage,
    },
    experimental_telemetry: {
      isEnabled: true,
      metadata: options?.traceId ? { langfusetraceId: options.traceId } : undefined,
    },
  });
}

// CLI-specific code (only runs when executed directly, not when imported)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  // Initialize OpenTelemetry for CLI
  const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  
  sdk.start();

  // Start CLI
  async function main() {
    const traceId = crypto.randomUUID();
    const unifiedAgent = createUnifiedAgent({ traceId });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    console.log('Unified Agent (Notion + Podcast)');

    const prompt = (query: string): Promise<string> =>
      new Promise((resolve) => rl.question(query, resolve));

    while (true) {
      const userInput = await prompt('You: ');
      if (userInput.toLowerCase() === 'quit') break;

      messages.push({ role: 'user', content: userInput });

      process.stdout.write('\nAssistant: ');

      try {
        const result = await unifiedAgent.stream({
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
}
