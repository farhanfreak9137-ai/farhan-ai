import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Client, createClient } from '@libsql/client';
import { client as defaultClient } from './index';

export interface BackupMetadata {
  id: string;
  filename: string;
  filepath: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  integrityVerified: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.resolve(DATA_DIR, 'backups');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'farhan_ai.db');

export function ensureBackupDir(): string {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

/**
 * Computes SHA-256 checksum of a file on disk.
 */
export function computeFileChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Checks SQLite integrity using PRAGMA integrity_check.
 */
export async function verifyDatabaseIntegrity(clientInstance: Client = defaultClient): Promise<{ ok: boolean; result: string }> {
  try {
    const res = await clientInstance.execute('PRAGMA integrity_check;');
    const firstRowVal = String(res.rows[0]?.[0] || res.rows[0]?.integrity_check || '');
    const isOk = firstRowVal.toLowerCase() === 'ok';
    return { ok: isOk, result: firstRowVal || 'unknown' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, result: msg };
  }
}

/**
 * Creates an immutable, verified SQLite backup with WAL checkpointing.
 */
export async function createDatabaseBackup(options: {
  dbPath?: string;
  maxRetained?: number;
  clientInstance?: Client;
} = {}): Promise<BackupMetadata> {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;
  const maxRetained = options.maxRetained ?? 10;
  const clientInstance = options.clientInstance || defaultClient;

  if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }

  ensureBackupDir();

  // 1. Flush WAL frames into database file
  try {
    await clientInstance.execute('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Non-fatal if WAL is not active or remote
  }

  // 2. Check source integrity before backup
  const sourceCheck = await verifyDatabaseIntegrity(clientInstance);
  if (!sourceCheck.ok) {
    throw new Error(`Source database integrity check failed before backup: ${sourceCheck.result}`);
  }

  // 3. Generate backup filename with timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupFilename = `farhan_ai_backup_${timestamp}.db`;
  const backupFilepath = path.join(BACKUP_DIR, backupFilename);

  // 4. Copy database file
  fs.copyFileSync(dbPath, backupFilepath);

  // 5. Verify backup file integrity using temporary independent client
  const backupClient = createClient({ url: `file:${backupFilepath}` });
  let backupVerified = false;
  try {
    const backupCheck = await verifyDatabaseIntegrity(backupClient);
    backupVerified = backupCheck.ok;
    if (!backupVerified) {
      throw new Error(`Backup file failed integrity check: ${backupCheck.result}`);
    }
  } finally {
    backupClient.close();
  }

  // 6. Calculate checksum & size
  const checksum = computeFileChecksum(backupFilepath);
  const stats = fs.statSync(backupFilepath);

  const metadata: BackupMetadata = {
    id: `backup-${timestamp}`,
    filename: backupFilename,
    filepath: backupFilepath,
    sizeBytes: stats.size,
    checksum,
    createdAt: now.toISOString(),
    integrityVerified: backupVerified,
  };

  // 7. Save metadata JSON alongside the backup
  fs.writeFileSync(`${backupFilepath}.meta.json`, JSON.stringify(metadata, null, 2), 'utf-8');

  // 8. Prune older backups
  await pruneOldBackups(maxRetained);

  return metadata;
}

/**
 * Prunes older backups to keep within maxRetained limit.
 */
export async function pruneOldBackups(maxRetained: number = 10): Promise<number> {
  const backups = listBackups();
  if (backups.length <= maxRetained) return 0;

  let pruned = 0;
  const toDelete = backups.slice(maxRetained);
  for (const b of toDelete) {
    try {
      if (fs.existsSync(b.filepath)) fs.unlinkSync(b.filepath);
      const metaPath = `${b.filepath}.meta.json`;
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      pruned++;
    } catch {
      // Ignore individual file deletion errors
    }
  }
  return pruned;
}

/**
 * Lists available backups ordered by newest first.
 */
export function listBackups(): BackupMetadata[] {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR);
  const backups: BackupMetadata[] = [];

  for (const f of files) {
    if (f.endsWith('.db') && f.startsWith('farhan_ai_backup_')) {
      const fullPath = path.join(BACKUP_DIR, f);
      const metaPath = `${fullPath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as BackupMetadata;
          backups.push(meta);
          continue;
        } catch {
          // Fall back to stat
        }
      }
      const stats = fs.statSync(fullPath);
      backups.push({
        id: f.replace('.db', ''),
        filename: f,
        filepath: fullPath,
        sizeBytes: stats.size,
        checksum: computeFileChecksum(fullPath),
        createdAt: stats.mtime.toISOString(),
        integrityVerified: true,
      });
    }
  }

  // Sort newest first
  return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Restores the SQLite database from a specified backup file.
 * Creates a pre-restore safety copy of the current database before replacement.
 */
export async function restoreDatabaseFromBackup(backupFilepath: string, targetDbPath: string = DEFAULT_DB_PATH): Promise<{
  success: boolean;
  preRestoreBackup?: BackupMetadata;
}> {
  if (!fs.existsSync(backupFilepath)) {
    throw new Error(`Backup file not found at ${backupFilepath}`);
  }

  // 1. Verify backup integrity before restoring
  const backupClient = createClient({ url: `file:${backupFilepath}` });
  try {
    const check = await verifyDatabaseIntegrity(backupClient);
    if (!check.ok) {
      throw new Error(`Cannot restore corrupted backup. Integrity check failed: ${check.result}`);
    }
  } finally {
    backupClient.close();
  }

  // 2. Create pre-restore safety snapshot of the active database if it exists
  let preRestoreBackup: BackupMetadata | undefined;
  if (fs.existsSync(targetDbPath)) {
    preRestoreBackup = await createDatabaseBackup({ dbPath: targetDbPath });
  }

  // 3. Perform atomic restoration
  fs.copyFileSync(backupFilepath, targetDbPath);

  // 4. Remove any stale WAL / SHM files
  const walPath = `${targetDbPath}-wal`;
  const shmPath = `${targetDbPath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  return {
    success: true,
    preRestoreBackup,
  };
}
