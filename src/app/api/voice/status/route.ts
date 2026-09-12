// src/app/api/voice/status/route.ts
import { NextResponse } from 'next/server';
import { getVoiceProviderStatus } from '@/lib/voice/factory';

import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * GET /api/voice/status
 * Returns current voice provider configuration, capabilities, and live HUD state.
 */
export async function GET() {
  try {
    const status = getVoiceProviderStatus();
    let hudState = null;
    try {
      const hudPath = path.resolve(process.cwd(), 'data/voice_hud_state.json');
      if (fs.existsSync(hudPath)) {
        hudState = JSON.parse(fs.readFileSync(hudPath, 'utf8'));
      }
    } catch {}

    return NextResponse.json({ ...status, hudState }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve voice status' },
      { status: 500 }
    );
  }
}
