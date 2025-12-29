import { transcribeAudio } from '../../../lib/transcribe';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return Response.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());

    const { text, language, segments } = await transcribeAudio(buffer);

    return Response.json({ text, language, segments });
  } catch (error) {
    console.error('Transcription error:', error);
    return Response.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}
