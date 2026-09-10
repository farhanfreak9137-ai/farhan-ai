// src/app/api/computer/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { handleComputerRequest } from '@/lib/computer/service';

export const runtime = 'nodejs';

/**
 * POST /api/computer/request
 * Handles computer control actions: validation -> policy -> persistence -> execution/202.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const { statusCode, body } = await handleComputerRequest(raw);
    return NextResponse.json(body, { status: statusCode });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
