// src/app/api/automation/[id]/run/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * POST /api/automation/[id]/run
 * Triggers immediate execution of a job.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await automationEngine.runJobNow(id);
    return NextResponse.json({ success: true, message: `Job ${id} execution triggered.` }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to run automation job' }, { status: 500 });
  }
}
