import { tool } from 'ai';
import { z } from 'zod';
import { checkAndDedup } from '../utils/podcast-store';

export const checkDuplicate = tool({
  description: 'Check if a podcast already exists in the saved podcasts list. Call this FIRST before searching or saving any podcast to avoid duplicates.',
  inputSchema: z.object({
    name: z.string().describe('The podcast name to check for duplicates'),
  }),
  execute: async ({ name }: { name: string }) => {
    return checkAndDedup(name);
  },
});
