// src/app/api/computer/actions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computerActions } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { playwrightComputerProvider } from '@/lib/computer/playwrightProvider';

export const runtime = 'nodejs';

/**
 * GET /api/computer/actions
 * Returns list of computer actions, optional filtering by sessionId or status.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let query = db.select().from(computerActions);

    const rows = await query.orderBy(desc(computerActions.createdAt)).limit(limit);

    let filtered = rows;
    if (sessionId) {
      filtered = filtered.filter((r) => r.sessionId === sessionId);
    }
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    const providerState = playwrightComputerProvider.getState();

    return NextResponse.json({
      actions: filtered,
      providerState,
      total: filtered.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
