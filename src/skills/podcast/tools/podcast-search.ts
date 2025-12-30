import { tool } from 'ai';
import { z } from 'zod';

// Detect Chinese characters for country selection
function detectCountry(query: string): string {
  return /[\u4e00-\u9fff]/.test(query) ? 'CN' : 'US';
}

export const podcastSearch = tool({
  description: 'Search for podcasts by name using iTunes API. Returns matching podcasts with their feed URLs.',
  inputSchema: z.object({
    query: z.string().describe('The podcast name to search for'),
  }),
  execute: async ({ query }: { query: string }) => {
    const country = detectCountry(query);
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=5&country=${country}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.results
      .filter((r: any) => r.feedUrl)
      .map((r: any) => ({
        name: r.collectionName,
        artist: r.artistName,
        feedUrl: r.feedUrl,
      }));
  },
});
