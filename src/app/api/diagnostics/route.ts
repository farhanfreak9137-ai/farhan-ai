import { NextResponse } from 'next/server';
import { getConfigDiagnostics } from '@/lib/config';
import { metrics } from '@/lib/observability/metrics';
import { listBackups } from '@/lib/db/backup';
import { getAppliedMigrations } from '@/lib/db/migrations';
import { client } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const configDiag = getConfigDiagnostics();
    const metricsSummary = metrics.getSummary();
    const backups = listBackups().slice(0, 5);
    const migrations = await getAppliedMigrations(client);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      config: configDiag,
      metrics: metricsSummary,
      migrations: {
        total: migrations.length,
        applied: migrations,
      },
      recentBackups: backups,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Diagnostics query failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
