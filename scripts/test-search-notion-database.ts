#!/usr/bin/env npx tsx
/**
 * Script to search Notion for databases and format the response
 *
 * Usage:
 *   pnpm tsx scripts/search-notion-database.ts [query]
 */

import 'dotenv/config';
import { Client } from '@notionhq/client';
import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';

async function main() {
  const query = process.argv[2];

  if (!process.env.NOTION_TOKEN) {
    console.error('Error: NOTION_TOKEN is not set in environment');
    process.exit(1);
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  console.log(`Searching Notion for databases matching: "${query}"\n`);

  const response = await notion.search({
    query,
    filter: {
      value: 'data_source',
      property: 'object',
    },
    sort: {
      direction: 'ascending',
      timestamp: 'last_edited_time',
    },
  });

  console.log('='.repeat(80));
  console.log('RAW RESPONSE:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(response, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('FORMATTED SUMMARY:');
  console.log('='.repeat(80));

  if (response.results.length === 0) {
    console.log('No databases found matching the query.');
    return;
  }

  console.log(`Found ${response.results.length} database(s):\n`);

  for (const result of response.results) {
    if (result.object === 'data_source' && 'title' in result) {
      const db = result;
      const title =
        db.title.map((t: RichTextItemResponse) => t.plain_text).join('') || '(Untitled)';

      console.log(`Database: ${title}`);
      console.log(`  ID: ${db.id}`);
      console.log(`  URL: ${db.url}`);
      console.log(`  Created: ${db.created_time}`);
      console.log(`  Last edited: ${db.last_edited_time}`);

      if (db.description && db.description.length > 0) {
        const desc = db.description.map((d: RichTextItemResponse) => d.plain_text).join('');
        console.log(`  Description: ${desc}`);
      }

      const propertyNames = Object.keys(db.properties);
      console.log(`  Properties (${propertyNames.length}): ${propertyNames.join(', ')}`);
      console.log('-'.repeat(80));
    }
  }

  console.log(`\nHas more: ${response.has_more}`);
  if (response.next_cursor) {
    console.log(`Next cursor: ${response.next_cursor}`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
