import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseBackup, listBackups, verifyDatabaseIntegrity } from '@/lib/db/backup';
import { logAuditEvent } from '@/lib/audit';
import { verifyRequestAuth } from '@/lib/security/auth';
import { client } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/backup
 * Lists available SQLite backups. Protected by server-side authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = verifyRequestAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.reason },
        { status: authResult.statusCode || 401 }
      );
    }

    const backups = listBackups();
    return NextResponse.json({
      success: true,
      total: backups.length,
      backups,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list backups';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/backup
 * Creates an atomic, verified SQLite backup with WAL checkpointing.
 * Strictly protected by server-side authorization and recorded in audit log.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = verifyRequestAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.reason },
        { status: authResult.statusCode || 401 }
      );
    }

    // 1. Verify database integrity before backup
    const integrityBefore = await verifyDatabaseIntegrity(client);
    if (!integrityBefore.ok) {
      return NextResponse.json(
        { error: 'Database integrity check failed', details: integrityBefore.result },
        { status: 500 }
      );
    }

    // 2. Perform server-side backup operation
    const backupMetadata = await createDatabaseBackup({ maxRetained: 10 });

    // 3. Log immutable audit event
    await logAuditEvent({
      eventType: 'backup_created',
      actor: authResult.actor || 'authenticated_operator',
      action: 'create_database_backup',
      status: 'SUCCESS',
      details: {
        backupId: backupMetadata.id,
        filename: backupMetadata.filename,
        checksum: backupMetadata.checksum,
        sizeBytes: backupMetadata.sizeBytes,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Database backup created and verified successfully',
      backup: backupMetadata,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database backup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
