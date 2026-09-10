// src/app/api/automation/[id]/runs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * GET /api/automation/[id]/runs
 * Lists execution runs for a specific job.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const runs = await automationEngine.listRuns(id, limit);
    return NextResponse.json({ runs }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list runs' }, { status: 500 });
  }
}
