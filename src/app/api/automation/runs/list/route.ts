// src/app/api/automation/runs/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * GET /api/automation/runs/list
 * Returns recent automation runs across all background jobs.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const runs = await automationEngine.listRuns(undefined, isNaN(limit) ? 30 : limit);
    return NextResponse.json({ runs }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list automation runs' }, { status: 500 });
  }
}
