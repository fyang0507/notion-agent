import { tool } from 'ai';
import { z } from 'zod';
import { recommendEpisodesFromFeeds } from '../utils/episode-recommender.js';

export const recommendEpisodes = tool({
  description:
    'Recommend podcast episodes from saved podcasts based on recent releases and optional criteria. Fetches episodes from all saved podcasts and uses AI to rank and recommend the best ones.',
  inputSchema: z.object({
    topN: z.number().optional().describe('Number of episodes to recommend (default: 3)'),
    days: z.number().optional().describe('Only consider episodes from the last N days (default: 90)'),
    criteria: z
      .string()
      .optional()
      .describe('Additional criteria for filtering/ranking (e.g., "Chinese podcasts only", "tech topics")'),
  }),
  execute: async ({ topN = 3, days = 90, criteria }) => {
    return recommendEpisodesFromFeeds(topN, days, criteria);
  },
});
