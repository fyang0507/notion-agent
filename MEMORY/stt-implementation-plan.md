# Plan: Add Speech-to-Text (STT) to notion-agent

## Requirements
- **Scope**: API endpoint only (UI to be built later)
- **Languages**: Bilingual - Chinese (Mandarin) + English
- **UX**: Record → Stop → Transcribe (like standard Whisper API)

---

## Provider: Groq + Whisper Large V3

| Provider | Chinese Support | Speed | Cost |
|----------|----------------|-------|------|
| **Groq + Whisper Large V3** | Yes (99+ langs) | 164x real-time | $0.03/hr |
| OpenAI Whisper | Yes (99+ langs) | Fast | ~$0.006/min |
| Deepgram Nova-2 | Yes (zh, zh-CN, zh-TW) | Fast | ~$0.0043/min |

**Why Groq:**
1. Whisper Large V3 has 1.55B params, excellent multilingual support
2. 164x real-time speed - transcribes 10min audio in 3.7 seconds
3. Cost effective: $0.03-0.04 per hour
4. Vercel AI SDK native via `@ai-sdk/groq`
5. Free tier for development

---

## Implementation

### Architecture

```
User records → User stops → Send complete audio → Transcribe → Return text
```

### Step 1: Create STT API Route

**File**: `src/app/api/transcribe/route.ts`

```typescript
import { experimental_transcribe as transcribe } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  const formData = await req.formData();
  const audioFile = formData.get('audio') as File;
  const buffer = Buffer.from(await audioFile.arrayBuffer());

  const { text, language, segments } = await transcribe({
    model: groq.transcription('whisper-large-v3'),
    audio: buffer,
  });

  return Response.json({ text, language, segments });
}
```

### Step 2: Add Dependencies

```bash
pnpm add @ai-sdk/groq
```

### Step 3: Environment Configuration

Add to `.env`:
```
GROQ_API_KEY=your_groq_api_key
```

### Step 4: Create Transcription Utility (optional)

**File**: `src/lib/transcribe.ts`

```typescript
import { experimental_transcribe as transcribe } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(audioBuffer: Buffer) {
  return transcribe({
    model: groq.transcription('whisper-large-v3'),
    audio: audioBuffer,
  });
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/transcribe/route.ts` | Create | API endpoint |
| `src/lib/transcribe.ts` | Create | Reusable utility |
| `.env` | Modify | Add GROQ_API_KEY |
| `package.json` | Modify | Add @ai-sdk/groq |

---

## Future: Browser Audio Capture (for UI)

```typescript
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
const chunks: Blob[] = [];

recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.start();

// When user clicks stop
recorder.stop();
recorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', blob);

  const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
  const { text } = await res.json();
};
```

---

## Sources

- [AI SDK Core: Transcription](https://ai-sdk.dev/docs/ai-sdk-core/transcription)
- [Groq Whisper Large v3](https://console.groq.com/docs/model/whisper-large-v3)
- [Deepgram Models & Languages](https://developers.deepgram.com/docs/models-languages-overview)
- [OpenAI Whisper](https://openai.com/index/whisper/)
