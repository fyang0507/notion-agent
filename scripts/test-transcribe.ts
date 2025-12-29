/**
 * Integration test for Speech-to-Text (STT) using Groq Whisper Large V3
 *
 * Usage:
 *   pnpm tsx scripts/test-transcribe.ts <audio-file-path>
 *
 * Example:
 *   pnpm tsx scripts/test-transcribe.ts ./test-audio.mp3
 *
 * Supported formats: mp3, wav, webm, m4a, mp4, ogg, flac
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { transcribeAudio } from '../src/lib/transcribe';

const SUPPORTED_FORMATS = ['.mp3', '.wav', '.webm', '.m4a', '.mp4', '.ogg', '.flac'];

async function main() {
  const audioPath = process.argv[2];

  if (!audioPath) {
    console.error('Usage: pnpm tsx scripts/test-transcribe.ts <audio-file-path>');
    console.error('\nSupported formats:', SUPPORTED_FORMATS.join(', '));
    process.exit(1);
  }

  // Validate file exists
  if (!fs.existsSync(audioPath)) {
    console.error(`Error: File not found: ${audioPath}`);
    process.exit(1);
  }

  // Validate file format
  const ext = path.extname(audioPath).toLowerCase();
  if (!SUPPORTED_FORMATS.includes(ext)) {
    console.error(`Error: Unsupported format: ${ext}`);
    console.error('Supported formats:', SUPPORTED_FORMATS.join(', '));
    process.exit(1);
  }

  // Check for GROQ_API_KEY
  if (!process.env.GROQ_API_KEY) {
    console.error('Error: GROQ_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log(`\nTranscribing: ${audioPath}`);
  console.log('Model: Groq Whisper Large V3\n');

  const startTime = Date.now();

  try {
    const audioBuffer = fs.readFileSync(audioPath);
    const result = await transcribeAudio(audioBuffer);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('--- Transcription Result ---\n');
    console.log(`Text: ${result.text}`);
    console.log(`\nDetected Language: ${result.language || 'N/A'}`);
    console.log(`Time: ${elapsed}s`);

    if (result.segments && result.segments.length > 0) {
      console.log(`\n--- Segments (${result.segments.length}) ---\n`);
      for (const seg of result.segments) {
        const start = seg.startSecond.toFixed(2);
        const end = seg.endSecond.toFixed(2);
        console.log(`[${start}s - ${end}s] ${seg.text}`);
      }
    }

    console.log('\n✓ Transcription successful');
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n✗ Transcription failed after ${elapsed}s`);
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
