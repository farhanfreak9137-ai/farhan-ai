// src/app/api/voice/command/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processVoiceCommand } from '@/lib/voice/voiceAssistant';

export const runtime = 'nodejs';

const CommandSchema = z.object({
  audio: z.string().optional(),
  transcript: z.string().optional(),
  conversationId: z.string().optional(),
  language: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
}).refine(data => data.audio || data.transcript, {
  message: 'Either audio or transcript must be provided',
});

/**
 * POST /api/voice/command
 * Orchestrates voice request -> transcription -> Central Assistant -> TTS audio.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parse = CommandSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid voice command payload', details: parse.error.format() },
        { status: 400 }
      );
    }

    const result = await processVoiceCommand(parse.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('[VoiceCommandRoute] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Voice command failed to process' },
      { status: 500 }
    );
  }
}
