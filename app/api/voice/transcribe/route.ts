import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type WhisperResult = {
  text?: string;
};

type WorkersAi = {
  run: (
    model: '@cf/openai/whisper',
    input: { audio: number[] },
  ) => Promise<unknown>;
};

export async function POST(request: Request) {
  if (process.env.PULSE_VOICE_CLOUD_ENABLED !== 'true')
    return Response.json(
      { error: 'Cloud voice is disabled for this deployment.' },
      { status: 404 },
    );

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('audio/'))
    return Response.json(
      { error: 'An audio recording is required.' },
      { status: 415 },
    );

  const audio = new Uint8Array(await request.arrayBuffer());
  if (!audio.byteLength)
    return Response.json(
      { error: 'The recording was empty.' },
      { status: 400 },
    );
  if (audio.byteLength > 10 * 1024 * 1024)
    return Response.json(
      { error: 'Keep voice commands under 30 seconds.' },
      { status: 413 },
    );

  try {
    const ai = (env as unknown as { AI: WorkersAi }).AI;
    const result = (await ai.run('@cf/openai/whisper', {
      audio: Array.from(audio),
    })) as WhisperResult;
    const transcript = result.text?.trim();
    if (!transcript)
      return Response.json(
        { error: 'No speech was detected. Please try again.' },
        { status: 422 },
      );
    return Response.json({ transcript });
  } catch (error) {
    console.error('Cloudflare voice transcription failed', error);
    return Response.json(
      { error: 'Cloud transcription is temporarily unavailable.' },
      { status: 503 },
    );
  }
}
