import { experimental_transcribe as transcribe, Experimental_TranscriptionResult } from 'ai';
import { createGroq } from '@ai-sdk/groq';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export interface TranscribeOptions {
  /** Optional language hint (e.g., 'zh', 'en') */
  language?: string;
}

/**
 * Transcribe audio using Groq's Whisper Large V3 model.
 * Supports 99+ languages including Chinese (Mandarin) and English.
 *
 * @param audioBuffer - Audio data as Buffer
 * @param options - Optional transcription settings
 * @returns Transcription result with text, detected language, and segments
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options: TranscribeOptions = {}
): Promise<Experimental_TranscriptionResult> {
  return transcribe({
    model: groq.transcription('whisper-large-v3'),
    audio: audioBuffer,
    providerOptions: options.language ? {
      groq: { language: options.language }
    } : undefined,
  });
}
