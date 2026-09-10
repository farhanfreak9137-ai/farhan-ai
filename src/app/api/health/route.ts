import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const startTime = Date.now();

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
}
