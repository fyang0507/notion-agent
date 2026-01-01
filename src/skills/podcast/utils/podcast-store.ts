/**
 * Podcast storage using agent-fs abstraction
 * Works both locally (filesystem) and on Vercel (GitHub API)
 */

import * as TOML from '@iarna/toml';
import { agentFS } from '../../../lib/agent-fs';

const PODCASTS_PATH = 'podcasts.toml';

export interface PodcastEntry {
  name: string;
  feedUrl: string;
}

interface PodcastsFile {
  podcasts: PodcastEntry[];
}

/**
 * Load all podcasts from storage
 */
export async function loadPodcasts(): Promise<PodcastEntry[]> {
  const fs = agentFS();
  const content = await fs.readFile(PODCASTS_PATH);

  if (!content) {
    return [];
  }

  const data = TOML.parse(content) as unknown as PodcastsFile;
  return data.podcasts || [];
}

/**
 * Save podcasts to storage (replaces entire file)
 */
async function savePodcasts(podcasts: PodcastEntry[]): Promise<void> {
  const fs = agentFS();
  const content = TOML.stringify({ podcasts } as unknown as TOML.JsonMap);
  await fs.writeFile(PODCASTS_PATH, content);
}

/**
 * Deduplicate podcast entries by feed URL
 */
function deduplicateEntries(podcasts: PodcastEntry[]): { unique: PodcastEntry[]; removedCount: number } {
  const seen = new Map<string, PodcastEntry>();

  for (const podcast of podcasts) {
    if (!podcast.name || !podcast.feedUrl) continue;

    const key = podcast.feedUrl.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, podcast);
    }
  }

  const unique = Array.from(seen.values());
  return {
    unique,
    removedCount: podcasts.length - unique.length,
  };
}

/**
 * Check if a podcast already exists and deduplicate storage
 */
export async function checkAndDedup(
  name: string
): Promise<{ isDuplicate: boolean; existingPodcast?: PodcastEntry; message: string }> {
  const podcasts = await loadPodcasts();

  if (podcasts.length === 0) {
    return {
      isDuplicate: false,
      message: 'No podcasts saved yet. You can proceed with searching and saving.',
    };
  }

  // Silently deduplicate existing entries
  const { unique, removedCount } = deduplicateEntries(podcasts);
  if (removedCount > 0) {
    await savePodcasts(unique);
  }

  const normalizedInput = name.toLowerCase().trim();
  const duplicate = unique.find((podcast) => podcast.name.toLowerCase().trim() === normalizedInput);

  if (duplicate) {
    return {
      isDuplicate: true,
      existingPodcast: duplicate,
      message: `Podcast "${duplicate.name}" is already saved with feed URL: ${duplicate.feedUrl}. No need to search or save again.`,
    };
  }

  return {
    isDuplicate: false,
    message: `No duplicate found for "${name}". You can proceed with searching and saving.`,
  };
}

/**
 * Append a new podcast to storage
 */
export async function appendPodcast(name: string, feedUrl: string): Promise<void> {
  const podcasts = await loadPodcasts();
  podcasts.push({ name, feedUrl });
  await savePodcasts(podcasts);
}
