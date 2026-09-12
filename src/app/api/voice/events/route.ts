// src/app/api/voice/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getVoiceEvents } from '@/lib/voice/voiceEvents';

export const runtime = 'nodejs';

/**
 * GET /api/voice/events?since=<timestamp>
 * Returns recent voice assistant utterances so the desktop UI updates synchronously.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const since = parseInt(searchParams.get('since') || '0', 10);
  const events = getVoiceEvents(isNaN(since) ? 0 : since);

  return NextResponse.json({
    success: true,
    count: events.length,
    events,
    serverTime: Date.now(),
  });
}
