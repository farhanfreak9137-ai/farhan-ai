// src/app/api/automation/approvals/[id]/deny/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { automationEngine } from '@/lib/automation/engine';

export const runtime = 'nodejs';

/**
 * POST /api/automation/approvals/[id]/deny
 * Rejects a pending consequential automation action.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await automationEngine.handleApproval(id, false);
    return NextResponse.json({ success: true, message: `Approval ${id} denied.` }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to deny action' }, { status: 500 });
  }
}
