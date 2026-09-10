// src/app/api/computer/actions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computerActions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/computer/actions/{id}
 * Returns the current status and result (if any) of a persisted computer action.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/');
    const actionId = segments[segments.length - 1];
    if (!actionId) {
      return NextResponse.json({ error: 'Action ID missing in URL' }, { status: 400 });
    }
    const row = await db.select().from(computerActions).where(eq(computerActions.id, actionId)).then((rows) => rows[0]);
    if (!row) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }
    const { status, result, updatedAt, createdAt, action, payload, sessionId } = row;
    return NextResponse.json({ id: actionId, action, sessionId, payload, status, result, createdAt, updatedAt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
