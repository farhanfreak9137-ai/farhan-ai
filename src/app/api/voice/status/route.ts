// src/app/api/voice/status/route.ts
import { NextResponse } from 'next/server';
import { getVoiceProviderStatus } from '@/lib/voice/factory';

export const runtime = 'nodejs';

/**
 * GET /api/voice/status
 * Returns current voice provider configuration, capabilities, and readiness.
 */
export async function GET() {
  try {
    const status = getVoiceProviderStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve voice status' },
      { status: 500 }
    );
  }
}
