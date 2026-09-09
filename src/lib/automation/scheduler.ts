// src/lib/automation/scheduler.ts
import { db, ensureDatabaseReady } from '@/lib/db';
import { automationJobs, automationRuns } from '@/lib/db/schema';
import { eq, and, lte, or, inArray } from 'drizzle-orm';
import {
  AutomationJob,
  CreateJobInput,
  UpdateJobInput,
  JobType,
  JobStatus,
} from './types';
import { AutomationExecutor, defaultAutomationExecutor } from './executor';
import { v4 as uuidv4 } from 'uuid';

export const MIN_INTERVAL_MS = 10000; // 10 seconds minimum interval for safety
export const MAX_CONCURRENT_RUNS = 3;
export const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Calculates the next execution timestamp for a given job schedule.
 */
export function calculateNextRun(type: JobType, schedule: string, fromDate: Date = new Date()): Date {
  if (type === 'once') {
    const target = new Date(schedule);
    return isNaN(target.getTime()) ? new Date(fromDate.getTime() + 60000) : target;
  }

  if (type === 'interval') {
    const rawMs = parseInt(schedule, 10);
    const ms = isNaN(rawMs) ? 60000 : Math.max(rawMs, MIN_INTERVAL_MS);
    return new Date(fromDate.getTime() + ms);
  }

  if (type === 'cron') {
    // Standard cron expression support: "min hour dom mon dow"
    // For common patterns like "0 9 * * *" (daily at 9am) or "*/5 * * * *"
    const parts = schedule.trim().split(/\s+/);
    if (parts.length === 5) {
      const [min, hour] = parts;
      if (min.startsWith('*/')) {
        const step = Math.max(parseInt(min.replace('*/', ''), 10) || 5, 1);
        const next = new Date(fromDate.getTime() + step * 60 * 1000);
        return next;
      }
      if (!isNaN(parseInt(min, 10)) && !isNaN(parseInt(hour, 10))) {
        const next = new Date(fromDate);
        next.setHours(parseInt(hour, 10), parseInt(min, 10), 0, 0);
        if (next.getTime() <= fromDate.getTime()) {
          next.setDate(next.getDate() + 1); // Next day
        }
        return next;
      }
    }
    // Fallback cron: 1 hour from now
    return new Date(fromDate.getTime() + 3600000);
  }

  return new Date(fromDate.getTime() + 60000);
}

export class AutomationScheduler {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private executor: AutomationExecutor;
  private runningJobIds = new Set<string>();

  constructor(executor: AutomationExecutor = defaultAutomationExecutor) {
    this.executor = executor;
  }

  /**
   * Starts the scheduler with bounded restart recovery.
   */
  async start(intervalCheckMs = 5000): Promise<void> {
    if (this.isRunning) return;
    await ensureDatabaseReady();
    this.isRunning = true;

    // 1. Process Restart Recovery
    await this.recoverAfterRestart();

    // 2. Start background tick check
    this.checkInterval = setInterval(() => {
      this.checkScheduledJobs().catch((err) => {
        console.error('[AutomationScheduler] Tick error:', err);
      });
    }, intervalCheckMs);

    // Ensure timer does not block process exit during tests or shutdowns
    if (this.checkInterval.unref) {
      this.checkInterval.unref();
    }
  }

  /**
   * Stops the scheduler cleanly.
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    this.runningJobIds.clear();
  }

  /**
   * Recovers scheduler state after process restart:
   * - Jobs interrupted in 'RUNNING' status are restored to 'SCHEDULED'.
   * - Bounded missed-run recovery: if a job's scheduled run was missed during downtime,
   *   we execute AT MOST ONE missed run, and compute the next scheduled time from now.
   * - We do not execute cascading loops of historical missed runs.
   */
  async recoverAfterRestart(): Promise<void> {
    await ensureDatabaseReady();
    const now = new Date();

    // 1. Reset orphaned RUNNING jobs to SCHEDULED
    const orphaned = await db
      .select()
      .from(automationJobs)
      .where(eq(automationJobs.status, 'RUNNING'));

    for (const job of orphaned) {
      await db
        .update(automationJobs)
        .set({
          status: 'SCHEDULED',
          updatedAt: now.toISOString(),
        })
        .where(eq(automationJobs.id, job.id));
    }

    // 2. Inspect missed runs for enabled SCHEDULED jobs
    const enabledJobs = await db
      .select()
      .from(automationJobs)
      .where(and(eq(automationJobs.enabled, 1), eq(automationJobs.status, 'SCHEDULED')));

    for (const row of enabledJobs) {
      const nextRun = row.nextRunAt ? new Date(row.nextRunAt) : null;
      if (nextRun && nextRun.getTime() < now.getTime()) {
        // Run was missed during downtime!
        // Apply bounded recovery: schedule it for immediate single execution
        console.log(`[AutomationScheduler] Missed run detected for job ${row.name} (due ${row.nextRunAt}). Triggering bounded catch-up run.`);
        await this.runJob(this.mapDbJobToAutomationJob(row));
      }
    }
  }

  /**
   * Periodic scheduler tick: checks for overdue enabled jobs and executes them.
   */
  async checkScheduledJobs(): Promise<void> {
    if (!this.isRunning) return;
    if (this.runningJobIds.size >= MAX_CONCURRENT_RUNS) return;

    await ensureDatabaseReady();
    const now = new Date().toISOString();

    const candidateJobs = await db
      .select()
      .from(automationJobs)
      .where(
        and(
          eq(automationJobs.enabled, 1),
          eq(automationJobs.status, 'SCHEDULED'),
          lte(automationJobs.nextRunAt, now)
        )
      )
      .limit(MAX_CONCURRENT_RUNS - this.runningJobIds.size);

    for (const row of candidateJobs) {
      if (this.runningJobIds.has(row.id)) continue;
      const job = this.mapDbJobToAutomationJob(row);
      // Run asynchronously so loop doesn't block
      this.runJob(job).catch((err) => {
        console.error(`[AutomationScheduler] Error running job ${job.id}:`, err);
      });
    }
  }

  /**
   * Executes a job with concurrency locking, bounded retries, and persistence.
   */
  async runJob(job: AutomationJob): Promise<void> {
    if (this.runningJobIds.has(job.id)) {
      console.warn(`[AutomationScheduler] Job ${job.id} is already running. Skipping duplicate execution.`);
      return;
    }

    this.runningJobIds.add(job.id);
    const now = new Date();

    try {
      // Transition job to RUNNING
      await db
        .update(automationJobs)
        .set({
          status: 'RUNNING',
          lastRunAt: now.toISOString(),
          updatedAt: now.toISOString(),
        })
        .where(eq(automationJobs.id, job.id));

      const runResult = await this.executor.executeJob(job);

      const nextRun = calculateNextRun(job.type, job.schedule, new Date());
      const nextRunIso = job.type === 'once' ? null : nextRun.toISOString();

      if (runResult.status === 'COMPLETED') {
        const finalStatus = job.type === 'once' ? 'COMPLETED' : 'SCHEDULED';
        await db
          .update(automationJobs)
          .set({
            status: finalStatus,
            enabled: job.type === 'once' ? 0 : 1,
            nextRunAt: nextRunIso,
            lastResult: runResult.result,
            failureCount: 0, // Reset failure count on success
            updatedAt: new Date().toISOString(),
          })
          .where(eq(automationJobs.id, job.id));
      } else if (runResult.status === 'WAITING_FOR_APPROVAL') {
        // Job hit an approval boundary: keep it in WAITING_FOR_APPROVAL status
        await db
          .update(automationJobs)
          .set({
            status: 'PAUSED', // Paused pending human review
            lastResult: runResult.result,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(automationJobs.id, job.id));
      } else {
        // FAILED
        const newFailureCount = (job.failureCount || 0) + 1;
        const shouldDisable = newFailureCount >= MAX_CONSECUTIVE_FAILURES;

        await db
          .update(automationJobs)
          .set({
            status: shouldDisable ? 'FAILED' : 'SCHEDULED',
            enabled: shouldDisable ? 0 : 1,
            failureCount: newFailureCount,
            nextRunAt: shouldDisable ? null : new Date(Date.now() + 30000 * newFailureCount).toISOString(),
            lastResult: { error: runResult.error },
            updatedAt: new Date().toISOString(),
          })
          .where(eq(automationJobs.id, job.id));
      }
    } catch (err: any) {
      console.error(`[AutomationScheduler] Unexpected failure running job ${job.id}:`, err);
      await db
        .update(automationJobs)
        .set({
          status: 'FAILED',
          failureCount: (job.failureCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(automationJobs.id, job.id));
    } finally {
      this.runningJobIds.delete(job.id);
    }
  }

  /**
   * Helper to map a database row to typed AutomationJob.
   */
  public mapDbJobToAutomationJob(row: any): AutomationJob {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type as JobType,
      schedule: row.schedule,
      status: row.status as JobStatus,
      enabled: row.enabled === 1,
      taskType: row.taskType as any,
      taskPayload: typeof row.taskPayload === 'string' ? JSON.parse(row.taskPayload) : row.taskPayload || {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      nextRunAt: row.nextRunAt,
      lastRunAt: row.lastRunAt,
      lastResult: typeof row.lastResult === 'string' ? JSON.parse(row.lastResult) : row.lastResult,
      failureCount: row.failureCount || 0,
    };
  }
}

export const defaultScheduler = new AutomationScheduler();
