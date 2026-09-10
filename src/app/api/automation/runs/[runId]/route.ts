// src/app/api/automation/runs/[runId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * GET /api/automation/runs/[runId]
 * Retrieves a single execution run by its ID.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await context.params;
    const run = await automationEngine.getRun(runId);
    if (!run) {
      return NextResponse.json({ error: `Run ${runId} not found` }, { status: 404 });
    }
    return NextResponse.json({ run }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve run' }, { status: 500 });
  }
}
