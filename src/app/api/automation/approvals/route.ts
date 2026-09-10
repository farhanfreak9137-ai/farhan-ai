// src/app/api/automation/approvals/route.ts
import { NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * GET /api/automation/approvals
 * Lists all pending background automation tasks waiting for approval.
 */
export async function GET() {
  try {
    const approvals = await automationEngine.listApprovals();
    return NextResponse.json({ approvals }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list approvals' }, { status: 500 });
  }
}
