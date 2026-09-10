// src/app/api/voice/speak/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVoiceProvider } from '@/lib/voice/factory';

export const runtime = 'nodejs';

const SpeakSchema = z.object({
  text: z.string().min(1, 'Text is required for speech synthesis'),
  language: z.string().optional(),
  voice: z.string().optional(),
  format: z.enum(['wav', 'mp3', 'ogg']).optional(),
});

/**
 * POST /api/voice/speak
 * Synthesizes text into audio data.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parse = SpeakSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid speak payload', details: parse.error.format() },
        { status: 400 }
      );
    }

    const provider = getVoiceProvider();
    const result = await provider.speak(parse.data);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to synthesize speech' },
      { status: 500 }
    );
  }
}
