// scripts/audit-objective7.ts
import { db, ensureDatabaseReady } from '../src/lib/db';
import { automationJobs, automationRuns, automationApprovals, notifications, computerActions } from '../src/lib/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
  await ensureDatabaseReady();

  const jobs = await db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt)).limit(5);
  const runs = await db.select().from(automationRuns).orderBy(desc(automationRuns.startedAt)).limit(5);
  const approvals = await db.select().from(automationApprovals).orderBy(desc(automationApprovals.createdAt)).limit(5);
  const notifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(5);

  console.log('=== 1. AUTOMATION JOBS (SQLite) ===');
  console.log(JSON.stringify(jobs.map(j => ({
    id: j.id,
    name: j.name,
    type: j.type,
    status: j.status,
    enabled: j.enabled,
    taskType: j.taskType,
    nextRunAt: j.nextRunAt,
    lastRunAt: j.lastRunAt,
    failureCount: j.failureCount,
  })), null, 2));

  console.log('\n=== 2. AUTOMATION RUNS (SQLite) ===');
  console.log(JSON.stringify(runs.map(r => ({
    id: r.id,
    jobId: r.jobId,
    status: r.status,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    hasResult: !!r.result,
    error: r.error,
  })), null, 2));

  console.log('\n=== 3. AUTOMATION APPROVALS (SQLite) ===');
  console.log(JSON.stringify(approvals.map(a => ({
    id: a.id,
    jobId: a.jobId,
    runId: a.runId,
    actionType: a.actionType,
    status: a.status,
    reason: a.reason,
    createdAt: a.createdAt,
  })), null, 2));

  console.log('\n=== 4. SYSTEM NOTIFICATIONS (SQLite) ===');
  console.log(JSON.stringify(notifs.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt,
  })), null, 2));
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
