import { NextResponse } from 'next/server';
import { client, ensureDatabaseReady } from '@/lib/db';
import { verifyDatabaseIntegrity } from '@/lib/db/backup';
import { getAppliedMigrations } from '@/lib/db/migrations';
import { getConfigDiagnostics } from '@/lib/config';
import { metrics } from '@/lib/observability/metrics';
import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const checks: Record<string, { status: 'pass' | 'fail'; message?: string; details?: unknown }> = {};
  let allPassing = true;

  // 1. Database connection check
  try {
    await ensureDatabaseReady();
    const queryResult = await client.execute('SELECT 1 as alive;');
    const isAlive = Number(queryResult.rows[0]?.alive) === 1;
    if (isAlive) {
      checks.database = { status: 'pass' };
    } else {
      allPassing = false;
      checks.database = { status: 'fail', message: 'Unexpected database probe result' };
    }
  } catch (err: unknown) {
    allPassing = false;
    checks.database = { status: 'fail', message: err instanceof Error ? err.message : String(err) };
  }

  // 2. Database integrity check
  try {
    const integrity = await verifyDatabaseIntegrity(client);
    if (integrity.ok) {
      checks.integrity = { status: 'pass', details: integrity.result };
    } else {
      allPassing = false;
      checks.integrity = { status: 'fail', message: integrity.result };
    }
  } catch (err: unknown) {
    allPassing = false;
    checks.integrity = { status: 'fail', message: err instanceof Error ? err.message : String(err) };
  }

  // 3. Migrations status
  try {
    const migrations = await getAppliedMigrations(client);
    checks.migrations = {
      status: migrations.length > 0 ? 'pass' : 'fail',
      details: { appliedCount: migrations.length, latest: migrations[migrations.length - 1]?.id },
    };
  } catch (err: unknown) {
    allPassing = false;
    checks.migrations = { status: 'fail', message: err instanceof Error ? err.message : String(err) };
  }

  // 4. File system write check
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    const testFile = path.join(dataDir, `.write-probe-${Date.now()}`);
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
    checks.diskStorage = { status: 'pass' };
  } catch (err: unknown) {
    allPassing = false;
    checks.diskStorage = { status: 'fail', message: err instanceof Error ? err.message : String(err) };
  }

  const configDiag = getConfigDiagnostics();
  const metricsSummary = metrics.getSummary();

  const statusCode = allPassing ? 200 : 503;
  return NextResponse.json(
    {
      ready: allPassing,
      timestamp: new Date().toISOString(),
      checks,
      config: configDiag,
      metrics: metricsSummary,
    },
    { status: statusCode }
  );
}
