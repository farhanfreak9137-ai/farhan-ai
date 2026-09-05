import { client, ensureDatabaseReady } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export type AuditEventType =
  | 'auth_success'
  | 'auth_failure'
  | 'rate_limit_exceeded'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'computer_action_requested'
  | 'computer_action_executed'
  | 'computer_action_denied'
  | 'system_command_executed'
  | 'file_operation_executed'
  | 'application_launched'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_failed'
  | 'backup_created'
  | 'backup_restored'
  | 'database_integrity_checked'
  | 'emergency_stop'
  | 'system_shutdown';

export interface AuditRecordInput {
  eventType: AuditEventType;
  actor: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'PENDING';
  ipAddress?: string;
  details?: Record<string, unknown>;
  error?: string;
}

export interface AuditRecord extends AuditRecordInput {
  id: string;
  timestamp: string;
}

const SENSITIVE_KEYS = new Set([
  'token',
  'authtoken',
  'authorization',
  'key',
  'apikey',
  'api_key',
  'secret',
  'password',
  'passwd',
  'cookie',
  'credentials',
  'farhan_auth_token',
  'gemini_api_key',
  'openai_api_key',
  'groq_api_key',
]);

/**
 * Recursively scrubs secrets, tokens, and credentials from details object.
 */
export function scrubSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(scrubSecrets);
  }

  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('key')) {
      cleaned[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      cleaned[k] = scrubSecrets(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

/**
 * Appends a verified audit record to the persistent SQLite audit_logs table.
 */
export async function logAuditEvent(input: AuditRecordInput): Promise<AuditRecord> {
  await ensureDatabaseReady();

  const id = `audit-${uuidv4()}`;
  const timestamp = new Date().toISOString();
  const scrubbedDetails = input.details ? scrubSecrets(input.details) : null;
  const detailsJson = scrubbedDetails ? JSON.stringify(scrubbedDetails) : null;

  try {
    await client.execute({
      sql: `INSERT INTO audit_logs (id, timestamp, event_type, actor, action, status, ip_address, details, error)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        id,
        timestamp,
        input.eventType,
        input.actor,
        input.action,
        input.status,
        input.ipAddress || null,
        detailsJson,
        input.error || null,
      ],
    });
  } catch (err: unknown) {
    // If audit logging fails, write to stderr but don't crash caller
    console.error('[AUDIT LOGGING FAILURE]', err);
  }

  return {
    id,
    timestamp,
    ...input,
    details: scrubbedDetails as Record<string, unknown> | undefined,
  };
}

export const recordAuditEvent = logAuditEvent;

/**
 * Queries audit logs with filtering options.
 */
export async function queryAuditLogs(options: {
  eventType?: AuditEventType;
  actor?: string;
  limit?: number;
  since?: string;
} = {}): Promise<AuditRecord[]> {
  await ensureDatabaseReady();

  const limit = options.limit ?? 50;
  const conditions: string[] = [];
  const args: any[] = [];

  if (options.eventType) {
    conditions.push('event_type = ?');
    args.push(options.eventType);
  }

  if (options.actor) {
    conditions.push('actor = ?');
    args.push(options.actor);
  }

  if (options.since) {
    conditions.push('timestamp >= ?');
    args.push(options.since);
  }

  let sql = 'SELECT * FROM audit_logs';
  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY timestamp DESC LIMIT ?;';
  args.push(limit);

  const res = await client.execute({ sql, args });

  return res.rows.map((row: any) => ({
    id: String(row.id),
    timestamp: String(row.timestamp),
    eventType: row.event_type as AuditEventType,
    actor: String(row.actor),
    action: String(row.action),
    status: row.status as 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'PENDING',
    ipAddress: row.ip_address ? String(row.ip_address) : undefined,
    details: row.details ? JSON.parse(String(row.details)) : undefined,
    error: row.error ? String(row.error) : undefined,
  }));
}
