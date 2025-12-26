import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';

const OUTPUT_PATH = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', 'podcasts.toml');

interface PodcastEntry {
  name: string;
  feedUrl: string;
}

interface PodcastsFile {
  podcasts: PodcastEntry[];
}

export function appendPodcast(name: string, feedUrl: string): void {
  // Ensure directory exists
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Read existing or create new
  let data: PodcastsFile = { podcasts: [] };
  if (fs.existsSync(OUTPUT_PATH)) {
    const content = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    data = TOML.parse(content) as unknown as PodcastsFile;
  }

  // Append new entry
  data.podcasts.push({ name, feedUrl });

  // Write back
  fs.writeFileSync(OUTPUT_PATH, TOML.stringify(data as any));
}
