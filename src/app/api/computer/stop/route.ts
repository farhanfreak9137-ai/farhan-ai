// src/app/api/computer/stop/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { handleComputerStop } from '@/lib/computer/service';

export const runtime = 'nodejs';

/**
 * POST /api/computer/stop
 * Immediately terminates a browser session and transitions any pending actions to CANCELLED.
 * Expected payload: { sessionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { statusCode, body: result } = await handleComputerStop(sessionId);
    return NextResponse.json(result, { status: statusCode });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
