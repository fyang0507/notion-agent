# Speech-to-Text (STT) Feature

Last Updated: 2025-12-29

## Summary

Added speech-to-text capability using Groq's Whisper Large V3 model via Vercel AI SDK. Supports bilingual transcription (Chinese + English) with segment-level timestamps.

## Provider Decision

**Selected: Groq + Whisper Large V3**

| Factor | Groq | OpenAI Whisper | Deepgram |
|--------|------|----------------|----------|
| Chinese support | Yes (99+ langs) | Yes | Yes |
| Speed | 164x real-time | Fast | Fast |
| Cost | $0.03/hr | ~$0.006/min | ~$0.0043/min |
| AI SDK integration | Native | Native | Requires custom |

Key advantages: Extreme speed (10min audio in 3.7s), free tier for development, native Vercel AI SDK support.

## Implementation

### Files Created

| File | Purpose |
|------|---------|
| `src/lib/transcribe.ts` | Core transcription utility with optional language hint |
| `src/app/api/transcribe/route.ts` | Next.js API endpoint (POST with FormData) |
| `scripts/test-transcribe.ts` | CLI test script for local validation |

### API Design

**Endpoint**: `POST /api/transcribe`

**Request**: FormData with `audio` field containing audio file

**Response**:
```json
{
  "text": "transcribed text",
  "language": "en",
  "segments": [{ "startSecond": 0.0, "endSecond": 1.5, "text": "..." }]
}
```

### Dependencies Added

- `@ai-sdk/groq` - Groq provider for Vercel AI SDK

### Environment Variables

- `GROQ_API_KEY` - Required for API access

## Usage

**CLI Testing**:
```bash
pnpm tsx scripts/test-transcribe.ts ./audio-file.mp3
```

**Supported formats**: mp3, wav, webm, m4a, mp4, ogg, flac

## Next Steps (Future)

- Browser audio capture UI using MediaRecorder API
- Streaming transcription for real-time use cases
