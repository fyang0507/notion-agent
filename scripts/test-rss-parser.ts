#!/usr/bin/env npx tsx
/**
 * Debug script for testing RSS parsing on a single feed
 *
 * Usage:
 *   pnpm tsx scripts/test-rss-parser.ts <feedUrl> [daysBack]
 *
 * Examples:
 *   pnpm tsx scripts/test-rss-parser.ts https://feed.example.com/rss
 *   pnpm tsx scripts/test-rss-parser.ts https://feed.example.com/rss 30
 */

import { fetchEpisodesFromFeed } from '../src/skills/podcast/utils/rss-fetcher.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: pnpm tsx scripts/test-rss-parser.ts <feedUrl> [daysBack]');
    console.error('');
    console.error('Arguments:');
    console.error('  feedUrl   - RSS feed URL to parse');
    console.error('  daysBack  - Only show episodes from last N days (default: 90)');
    process.exit(1);
  }

  const feedUrl = args[0];
  const daysBack = parseInt(args[1] || '90', 10);

  console.log(`Fetching RSS feed: ${feedUrl}`);
  console.log(`Filtering to last ${daysBack} days\n`);

  const result = await fetchEpisodesFromFeed(feedUrl, 'Test Podcast', daysBack);

  if (result.error) {
    console.error(`Error fetching feed: ${result.error}`);
    process.exit(1);
  }

  if (result.episodes.length === 0) {
    console.log('No episodes found within the date range.');
    process.exit(0);
  }

  console.log(`Found ${result.episodes.length} episodes:\n`);
  console.log('='.repeat(80));

  for (const episode of result.episodes) {
    console.log(`\nTitle: ${episode.title}`);
    console.log(`Date: ${episode.pubDate.toLocaleDateString()}`);
    if (episode.duration) {
      console.log(`Duration: ${episode.duration}`);
    }
    console.log(`Podcast: ${episode.podcastName}`);
    if (episode.description) {
      console.log(`Description: ${episode.description.slice(0, 200)}${episode.description.length > 200 ? '...' : ''}`);
    }
    console.log('-'.repeat(80));
  }
}

main().catch(console.error);
