import { NextRequest, NextResponse } from 'next/server';
import { queryAuditLogs, AuditEventType } from '@/lib/audit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventType = (searchParams.get('eventType') as AuditEventType) || undefined;
    const actor = searchParams.get('actor') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const since = searchParams.get('since') || undefined;

    const logs = await queryAuditLogs({ eventType, actor, limit, since });
    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query audit logs';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
