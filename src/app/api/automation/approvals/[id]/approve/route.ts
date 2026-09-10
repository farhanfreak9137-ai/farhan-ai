// src/app/api/automation/approvals/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * POST /api/automation/approvals/[id]/approve
 * Authorizes a pending consequential automation action.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await automationEngine.handleApproval(id, true);
    return NextResponse.json({ success: true, message: `Approval ${id} granted.` }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to approve action' }, { status: 500 });
  }
}
