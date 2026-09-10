// src/app/api/computer/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleComputerApprove } from '@/lib/computer/service';

export const runtime = 'nodejs';

const ApproveSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  notes: z.string().optional(),
});

/**
 * POST /api/computer/approve
 * Approves or denies a pending consequential action.
 * Executes ONLY using the immutable persisted payload.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parse = ApproveSchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid approve payload', details: parse.error.format() },
        { status: 400 }
      );
    }

    const { requestId, approve, notes } = parse.data;
    const { statusCode, body } = await handleComputerApprove(requestId, approve, notes);
    return NextResponse.json(body, { status: statusCode });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
