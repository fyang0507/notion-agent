import { tool } from 'ai';
import { z } from 'zod';
import { appendPodcast } from '../utils/podcast-store';

export const savePodcast = tool({
  description: 'Save a confirmed podcast to the local TOML file. Call this after the user confirms which podcast they want to save.',
  inputSchema: z.object({
    name: z.string().describe('The podcast name'),
    feedUrl: z.string().describe('The podcast RSS feed URL'),
  }),
  execute: async ({ name, feedUrl }: { name: string; feedUrl: string }) => {
    await appendPodcast(name, feedUrl);
    return { success: true, message: `Saved "${name}" to podcasts.toml` };
  },
});
