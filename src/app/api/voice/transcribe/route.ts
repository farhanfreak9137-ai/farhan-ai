// src/app/api/voice/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVoiceProvider } from '@/lib/voice/factory';

export const runtime = 'nodejs';

const TranscribeSchema = z.object({
  audio: z.string().min(1, 'Audio base64 data is required'),
  language: z.string().optional(),
  format: z.enum(['wav', 'webm', 'mp3', 'ogg']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/voice/transcribe
 * Transcribes audio via server-side voice provider.
 * Secrets remain strictly server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parse = TranscribeSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid transcription payload', details: parse.error.format() },
        { status: 400 }
      );
    }

    const provider = getVoiceProvider();
    const result = await provider.transcribe(parse.data);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
