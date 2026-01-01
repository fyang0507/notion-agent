import { loadPodcasts, checkAndDedup, appendPodcast } from './utils/podcast-store';
import { recommendEpisodesFromFeeds } from './utils/episode-recommender';

// Detect Chinese characters for country selection
function detectCountry(query: string): string {
  return /[\u4e00-\u9fff]/.test(query) ? 'CN' : 'US';
}

async function searchPodcast(query: string): Promise<string> {
  const country = detectCountry(query);
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=5&country=${country}`;

  const response = await fetch(url);
  const data = await response.json();

  const results = data.results
    .filter((r: any) => r.feedUrl)
    .map((r: any) => ({
      name: r.collectionName,
      artist: r.artistName,
      feedUrl: r.feedUrl,
    }));

  if (results.length === 0) {
    return `No podcasts found for "${query}".`;
  }

  return results.map((r: any, i: number) => `${i + 1}. ${r.name} by ${r.artist}\n   Feed: ${r.feedUrl}`).join('\n\n');
}

export type CommandHandler = (args: string) => string | Promise<string>;

/**
 * Create podcast command handlers for the command executor
 */
export function createPodcastCommands(): Record<string, CommandHandler> {
  return {
    'podcast help': () => `## Podcast Commands

- podcast list               - List saved podcasts
- podcast search <query>     - Search iTunes for podcasts
- podcast save <name> <url>  - Save a podcast to local storage
- podcast check <name>       - Check if podcast already saved
- podcast recommend [opts]   - Get episode recommendations

Options for recommend:
  topN=<number>     Number of episodes (default: 3)
  days=<number>     Days to look back (default: 90)
  criteria="<text>" Additional filtering criteria`,

    'podcast list': async () => {
      const podcasts = await loadPodcasts();
      if (podcasts.length === 0) {
        return 'No podcasts saved yet.';
      }
      return podcasts.map((p) => `- ${p.name}\n  ${p.feedUrl}`).join('\n\n');
    },

    'podcast search': async (query) => {
      if (!query) return 'Error: Usage: podcast search <query>';
      return searchPodcast(query);
    },

    'podcast save': async (args) => {
      if (!args) return 'Error: Usage: podcast save "<name>" "<feedUrl>"';

      // Parse quoted arguments: "name" "url"
      const match = args.match(/^"([^"]+)"\s+"([^"]+)"$/);
      if (!match) {
        return 'Error: Usage: podcast save "<name>" "<feedUrl>". Both name and URL must be quoted.';
      }

      const [, name, feedUrl] = match;

      // Check for duplicate first
      const dupCheck = await checkAndDedup(name);
      if (dupCheck.isDuplicate) {
        return `Error: ${dupCheck.message}`;
      }

      await appendPodcast(name, feedUrl);
      return `Saved "${name}" to podcasts.toml`;
    },

    'podcast check': async (name) => {
      if (!name) return 'Error: Usage: podcast check <name>';

      const result = await checkAndDedup(name);
      return result.message;
    },

    'podcast recommend': async (args) => {
      // Parse optional arguments: topN=3 days=90 criteria="..."
      let topN = 3;
      let days = 90;
      let criteria: string | undefined;

      if (args) {
        const topNMatch = args.match(/topN=(\d+)/);
        if (topNMatch) topN = parseInt(topNMatch[1], 10);

        const daysMatch = args.match(/days=(\d+)/);
        if (daysMatch) days = parseInt(daysMatch[1], 10);

        const criteriaMatch = args.match(/criteria="([^"]+)"/);
        if (criteriaMatch) criteria = criteriaMatch[1];
      }

      const result = await recommendEpisodesFromFeeds(topN, days, criteria);

      if (!result.success) {
        return `Error: ${result.message}`;
      }

      let output = result.message;
      if (result.feedErrors && result.feedErrors.length > 0) {
        output += `\n\n[Feed Errors: ${result.feedErrors.map((e) => e.error).join('; ')}]`;
      }
      return output;
    },
  };
}
