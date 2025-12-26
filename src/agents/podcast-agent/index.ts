import 'dotenv/config';
import { ToolLoopAgent } from 'ai';
import * as readline from 'readline';
import { podcastSearch } from './tools/podcast-search.js';
import { savePodcast } from './tools/save-podcast.js';
import { checkDuplicate } from './tools/check-duplicate.js';
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
 
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});
 
sdk.start();

// Define the podcast search agent
const podcastAgent = new ToolLoopAgent({
  model: 'google/gemini-3-flash',
  instructions: `You are a podcast search assistant.

When the user provides a podcast name:
1. FIRST: Use the check_duplicate tool to check if the podcast is already saved
2. If duplicate found: Inform the user that the podcast is already saved and stop (do NOT search or save)
3. If no duplicate: Use the podcast_search tool to find matching podcasts
4. If no results: Ask user to verify the podcast name or try alternative spellings
5. If multiple results: Present numbered options and ask user to pick one
6. Once user confirms (or if there's exactly one match): Use the save_podcast tool to save it`,
  tools: {
    check_duplicate: checkDuplicate,
    podcast_search: podcastSearch,
    save_podcast: savePodcast,
  },
  experimental_telemetry: { isEnabled: true },
});

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  console.log('Podcast Search Agent');

  const prompt = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  while (true) {
    const userInput = await prompt('You: ');
    if (userInput.toLowerCase() === 'quit') break;

    messages.push({ role: 'user', content: userInput });

    process.stdout.write('\nAssistant: ');

    try {
      const result = await podcastAgent.stream({
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
