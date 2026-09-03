import { Client } from '@libsql/client';

export interface Migration {
  id: string;
  name: string;
  up: (client: Client) => Promise<void>;
}

/**
 * Ordered list of verified schema migrations.
 * Migration history reflects reality without fabricating past migrations.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: '001_baseline_schema',
    name: 'Verified baseline schema for Farhan AI (Objectives 1-7)',
    up: async (client: Client) => {
      // Create migration tracking table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      // Core baseline tables are already created or verified by bootstrap
      // Here we guarantee existence for any clean environment
      await client.executeMultiple(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          filename TEXT,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT,
          size INTEGER,
          checksum TEXT,
          status TEXT,
          metadata TEXT,
          added_at TEXT NOT NULL,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS document_chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          page INTEGER,
          source TEXT NOT NULL,
          token_estimate INTEGER NOT NULL,
          embedding TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS applications (
          id TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          role TEXT NOT NULL,
          location TEXT NOT NULL,
          work_model TEXT NOT NULL,
          status TEXT NOT NULL,
          match_score INTEGER NOT NULL,
          salary_range TEXT,
          notes TEXT,
          proposal_draft TEXT,
          applied_date TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT,
          confidence REAL,
          verified INTEGER,
          status TEXT,
          superseded_by TEXT,
          supersedes TEXT,
          expires_at TEXT,
          source_document_id TEXT,
          source_conversation_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS memory_events (
          id TEXT PRIMARY KEY,
          memory_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          details TEXT,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS opportunities (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          company TEXT NOT NULL,
          location TEXT NOT NULL,
          work_model TEXT NOT NULL,
          salary_range TEXT,
          description TEXT NOT NULL,
          required_skills TEXT NOT NULL,
          url TEXT,
          posted_at TEXT NOT NULL,
          source TEXT,
          retrieved_at TEXT,
          external_id TEXT
        );
        CREATE TABLE IF NOT EXISTS computer_actions (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          action TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
          result TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS automation_jobs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          schedule TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'SCHEDULED',
          enabled INTEGER NOT NULL DEFAULT 1,
          task_type TEXT NOT NULL,
          task_payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          next_run_at TEXT,
          last_run_at TEXT,
          last_result TEXT,
          failure_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS automation_runs (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          result TEXT,
          error TEXT,
          steps TEXT
        );
        CREATE TABLE IF NOT EXISTS automation_approvals (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          action_id TEXT,
          action_type TEXT NOT NULL,
          reason TEXT NOT NULL,
          requested_action TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TEXT NOT NULL,
          expires_at TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          data TEXT,
          read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    id: '002_audit_logs',
    name: 'Add append-only audit_logs table and indexing',
    up: async (client: Client) => {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          event_type TEXT NOT NULL,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          ip_address TEXT,
          details TEXT,
          error TEXT
        );
      `);
      try {
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);`);
        await client.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);`);
      } catch {
        // Index creation may be skipped if existing
      }
    },
  },
];

/**
 * Fetches all applied migrations from the database.
 */
export async function getAppliedMigrations(client: Client): Promise<{ id: string; name: string; appliedAt: string }[]> {
  try {
    const res = await client.execute('SELECT id, name, applied_at FROM schema_migrations ORDER BY applied_at ASC;');
    return res.rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      appliedAt: String(row.applied_at),
    }));
  } catch {
    // If schema_migrations table does not exist yet
    return [];
  }
}

/**
 * Runs pending database migrations.
 */
export async function runMigrations(client: Client): Promise<{ applied: string[]; alreadyUpToDate: boolean }> {
  // Ensure schema_migrations exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedList = await getAppliedMigrations(client);
  const appliedSet = new Set(appliedList.map((m) => m.id));

  const newlyApplied: string[] = [];

  for (const migration of MIGRATIONS) {
    if (!appliedSet.has(migration.id)) {
      await migration.up(client);
      await client.execute({
        sql: 'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?);',
        args: [migration.id, migration.name, new Date().toISOString()],
      });
      newlyApplied.push(migration.id);
    }
  }

  return {
    applied: newlyApplied,
    alreadyUpToDate: newlyApplied.length === 0,
  };
}
