import { NextRequest, NextResponse } from 'next/server';
import { getMonitoredAlerts, runOpportunityScan, dismissAlert } from '@/lib/scanner/monitor';

export async function GET() {
  try {
    const alerts = await getMonitoredAlerts();
    return NextResponse.json({ alerts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch alerts';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === 'scan') {
      const threshold = Number(body.minMatchThreshold) || 85;
      const scanResult = await runOpportunityScan(threshold);
      return NextResponse.json({ success: true, ...scanResult });
    }

    if (body.action === 'dismiss') {
      const ok = await dismissAlert(body.id);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Opportunity monitor error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
