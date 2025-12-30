import Parser from 'rss-parser';
import { RECOMMENDATION_CONFIG } from '../config/recommendation-config';

export interface Episode {
  title: string;
  description: string;
  pubDate: Date;
  duration: string | undefined;
  // link: string; // disable link, no use for LLM
  podcastName: string;
}

interface FeedResult {
  episodes: Episode[];
  error?: string;
}

interface AllFeedsResult {
  episodes: Episode[];
  errors: { feedUrl: string; error: string }[];
}

const parser = new Parser({
  timeout: RECOMMENDATION_CONFIG.feedTimeoutMs,
});

function truncateDescription(description: string | undefined): string {
  if (!description) return '';
  const cleaned = description.replace(/<[^>]*>/g, '').trim();
  if (cleaned.length <= RECOMMENDATION_CONFIG.maxDescriptionLength) {
    return cleaned;
  }
  return cleaned.slice(0, RECOMMENDATION_CONFIG.maxDescriptionLength) + '...';
}

function isWithinDays(date: Date, daysBack: number): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  return date >= cutoff;
}

export async function fetchEpisodesFromFeed(
  feedUrl: string,
  podcastName: string,
  daysBack: number
): Promise<FeedResult> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const episodes: Episode[] = [];

    for (const item of feed.items.slice(0, RECOMMENDATION_CONFIG.maxEpisodesPerFeed)) {
      const pubDate = item.pubDate ? new Date(item.pubDate) : null;

      if (!pubDate || !isWithinDays(pubDate, daysBack)) {
        continue;
      }

      episodes.push({
        title: item.title || 'Untitled',
        description: truncateDescription(item.contentSnippet || item.content),
        pubDate,
        duration: item.itunes?.duration,
        // link: item.link || item.enclosure?.url || '', 
        podcastName,
      });
    }

    return { episodes };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { episodes: [], error: errorMessage };
  }
}

export async function fetchAllEpisodes(
  podcasts: { name: string; feedUrl: string }[],
  daysBack: number
): Promise<AllFeedsResult> {
  const results = await Promise.allSettled(
    podcasts.map((podcast) =>
      fetchEpisodesFromFeed(podcast.feedUrl, podcast.name, daysBack)
    )
  );

  const allEpisodes: Episode[] = [];
  const errors: { feedUrl: string; error: string }[] = [];

  results.forEach((result, index) => {
    const podcast = podcasts[index];

    if (result.status === 'fulfilled') {
      const { episodes, error } = result.value;
      allEpisodes.push(...episodes);
      if (error) {
        errors.push({ feedUrl: podcast.feedUrl, error });
      }
    } else {
      errors.push({
        feedUrl: podcast.feedUrl,
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  // Sort by publication date (newest first)
  allEpisodes.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return { episodes: allEpisodes, errors };
}
