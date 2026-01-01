import { generateText } from 'ai';
import { fetchAllEpisodes, type Episode } from './rss-fetcher';
import { loadPodcasts } from './podcast-store';
import { RECOMMENDATION_CONFIG } from '../config/recommendation-config';

export interface RecommendResult {
  success: boolean;
  message: string;
  feedErrors?: { feedUrl: string; error: string }[];
}

function formatEpisodeForLLM(episode: Episode, index: number): string {
  const date = episode.pubDate.toLocaleDateString();
  const duration = episode.duration || 'N/A';
  const description = episode.description.replace(/\n+/g, ' ').trim();
  return `## [Candidate Podcast ${index}]\nTitle: ${episode.title}\nShow: ${episode.podcastName}\nDate: ${date}\nDuration: ${duration}\nDescription: ${description}`;
}

export async function recommendEpisodesFromFeeds(
  topN: number = 3,
  days: number = 90,
  criteria?: string
): Promise<RecommendResult> {
  const podcasts = await loadPodcasts();

  if (podcasts.length === 0) {
    return {
      success: false,
      message: 'No podcasts saved yet. Use the save_podcast tool to add some podcasts first.',
    };
  }

  const { episodes, errors } = await fetchAllEpisodes(podcasts, days);

  if (episodes.length === 0) {
    const errorInfo = errors.length > 0 ? ` Errors: ${errors.map((e) => e.error).join('; ')}` : '';
    return {
      success: false,
      message: `No episodes found in the last ${days} days.${errorInfo}`,
    };
  }

  const episodeList = episodes.map((ep, i) => formatEpisodeForLLM(ep, i)).join('\n\n');
  const additionalCriteria = criteria ? `\n\n# Prioritize the following Criteria as it is specified by the user directly:\n${criteria}` : '';

  const prompt = `You are a podcast recommendation assistant. Given the following list of recent podcast episodes, recommend the top ${topN} episodes.

# Default Ranking Criteria:
${RECOMMENDATION_CONFIG.defaultCriteria}${additionalCriteria}

# Candidate Episodes (The episode's spoken language is the same as the title/description):
${episodeList}

# Output
Recommend the ${topN} best episodes. For each, explain concisely why it's worth listening to. Return in bullet points.`;

  try {
    const { text } = await generateText({
      model: 'deepseek/deepseek-v3.2',
      prompt,
      experimental_telemetry: { isEnabled: true },
    });

    return {
      success: true,
      message: text,
      feedErrors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('LLM ranking failed:', error);
    return {
      success: false,
      message: `LLM ranking failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      feedErrors: errors.length > 0 ? errors : undefined,
    };
  }
}
