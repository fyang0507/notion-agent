import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';

const OUTPUT_PATH = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'podcasts.toml');

export interface PodcastEntry {
  name: string;
  feedUrl: string;
}

interface PodcastsFile {
  podcasts: PodcastEntry[];
}

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

export function checkAndDedup(name: string): { isDuplicate: boolean; existingPodcast?: PodcastEntry; message: string } {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return {
      isDuplicate: false,
      message: 'No podcasts saved yet. You can proceed with searching and saving.',
    };
  }

  const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
  const data = TOML.parse(content) as unknown as PodcastsFile;

  // Silently deduplicate existing entries
  const { unique, removedCount } = deduplicateEntries(data.podcasts);
  if (removedCount > 0) {
    fs.writeFileSync(OUTPUT_PATH, TOML.stringify({ podcasts: unique } as any));
  }

  const normalizedInput = name.toLowerCase().trim();
  const duplicate = unique.find(
    (podcast) => podcast.name.toLowerCase().trim() === normalizedInput
  );

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
