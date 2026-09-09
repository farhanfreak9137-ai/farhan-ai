// src/lib/automation/engine.ts
import { db, ensureDatabaseReady } from '@/lib/db';
import { automationJobs, automationRuns, automationApprovals } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  AutomationJob,
  AutomationRun,
  AutomationApproval,
  CreateJobInput,
  UpdateJobInput,
} from './types';
import { defaultScheduler, calculateNextRun, MIN_INTERVAL_MS } from './scheduler';
import { evaluateAutomationPolicy } from './policies';

export class AutomationEngine {
  private static instance: AutomationEngine;

  public static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine();
    }
    return AutomationEngine.instance;
  }

  async start(): Promise<void> {
    await defaultScheduler.start();
  }

  stop(): void {
    defaultScheduler.stop();
  }

  /**
   * Creates and persists a new automation job.
   */
  async createJob(input: CreateJobInput): Promise<AutomationJob> {
    await ensureDatabaseReady();

    // 1. Validate schedule safety
    if (input.type === 'interval') {
      const ms = parseInt(input.schedule, 10);
      if (isNaN(ms) || ms < MIN_INTERVAL_MS) {
        throw new Error(`Minimum interval is ${MIN_INTERVAL_MS}ms (${MIN_INTERVAL_MS / 1000}s) to prevent runaway automation.`);
      }
    }

    // 2. Validate policy classification
    const policy = evaluateAutomationPolicy(input.taskType, input.taskPayload);
    if (policy.level === 'DENIED') {
      throw new Error(`Job denied by automation policy: ${policy.reason}`);
    }

    const id = uuidv4();
    const now = new Date();
    const nextRun = calculateNextRun(input.type, input.schedule, now);

    const jobRow = {
      id,
      name: input.name,
      description: input.description || null,
      type: input.type,
      schedule: input.schedule,
      status: 'SCHEDULED',
      enabled: input.enabled !== false ? 1 : 0,
      taskType: input.taskType,
      taskPayload: input.taskPayload,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      nextRunAt: nextRun.toISOString(),
      failureCount: 0,
    };

    await db.insert(automationJobs).values(jobRow);

    return defaultScheduler.mapDbJobToAutomationJob(jobRow);
  }

  /**
   * Updates an existing job definition.
   */
  async updateJob(id: string, input: UpdateJobInput): Promise<AutomationJob> {
    await ensureDatabaseReady();
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error(`Automation job ${id} not found.`);
    }

    if (input.type === 'interval' && input.schedule) {
      const ms = parseInt(input.schedule, 10);
      if (isNaN(ms) || ms < MIN_INTERVAL_MS) {
        throw new Error(`Minimum interval is ${MIN_INTERVAL_MS}ms (${MIN_INTERVAL_MS / 1000}s).`);
      }
    }

    const updates: any = {
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.schedule !== undefined) updates.schedule = input.schedule;
    if (input.type !== undefined) updates.type = input.type;
    if (input.taskType !== undefined) updates.taskType = input.taskType;
    if (input.taskPayload !== undefined) updates.taskPayload = input.taskPayload;
    if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;

    if (input.schedule || input.type) {
      const newType = input.type || existing.type;
      const newSchedule = input.schedule || existing.schedule;
      updates.nextRunAt = calculateNextRun(newType, newSchedule, new Date()).toISOString();
    }

    await db.update(automationJobs).set(updates).where(eq(automationJobs.id, id));
    const updated = await this.getJob(id);
    return updated!;
  }

  /**
   * Pauses an active job.
   */
  async pauseJob(id: string): Promise<AutomationJob> {
    await ensureDatabaseReady();
    await db
      .update(automationJobs)
      .set({ status: 'PAUSED', updatedAt: new Date().toISOString() })
      .where(eq(automationJobs.id, id));

    const job = await this.getJob(id);
    if (!job) throw new Error(`Job ${id} not found`);
    return job;
  }

  /**
   * Resumes a paused job.
   */
  async resumeJob(id: string): Promise<AutomationJob> {
    await ensureDatabaseReady();
    const existing = await this.getJob(id);
    if (!existing) throw new Error(`Job ${id} not found`);

    const nextRun = calculateNextRun(existing.type, existing.schedule, new Date());
    await db
      .update(automationJobs)
      .set({
        status: 'SCHEDULED',
        enabled: 1,
        nextRunAt: nextRun.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(automationJobs.id, id));

    const job = await this.getJob(id);
    return job!;
  }

  /**
   * Cancels a job permanently.
   */
  async cancelJob(id: string): Promise<AutomationJob> {
    await ensureDatabaseReady();
    await db
      .update(automationJobs)
      .set({ status: 'CANCELLED', enabled: 0, updatedAt: new Date().toISOString() })
      .where(eq(automationJobs.id, id));

    const job = await this.getJob(id);
    if (!job) throw new Error(`Job ${id} not found`);
    return job;
  }

  /**
   * Deletes a job record from the database.
   */
  async deleteJob(id: string): Promise<boolean> {
    await ensureDatabaseReady();
    await db.delete(automationJobs).where(eq(automationJobs.id, id));
    return true;
  }

  /**
   * Triggers immediate execution of a job out of schedule.
   */
  async runJobNow(id: string): Promise<void> {
    await ensureDatabaseReady();
    const job = await this.getJob(id);
    if (!job) throw new Error(`Job ${id} not found`);

    await defaultScheduler.runJob(job);
  }

  /**
   * Retrieves a single job by ID.
   */
  async getJob(id: string): Promise<AutomationJob | null> {
    await ensureDatabaseReady();
    const rows = await db.select().from(automationJobs).where(eq(automationJobs.id, id)).limit(1);
    if (rows.length === 0) return null;
    return defaultScheduler.mapDbJobToAutomationJob(rows[0]);
  }

  /**
   * Lists all jobs in SQLite.
   */
  async listJobs(): Promise<AutomationJob[]> {
    await ensureDatabaseReady();
    const rows = await db.select().from(automationJobs).orderBy(desc(automationJobs.createdAt));
    return rows.map((r) => defaultScheduler.mapDbJobToAutomationJob(r));
  }

  /**
   * Lists execution runs for all jobs or a specific job.
   */
  async listRuns(jobId?: string, limit = 50): Promise<AutomationRun[]> {
    await ensureDatabaseReady();
    let query = db.select().from(automationRuns);

    const rows = jobId
      ? await query.where(eq(automationRuns.jobId, jobId)).orderBy(desc(automationRuns.startedAt)).limit(limit)
      : await query.orderBy(desc(automationRuns.startedAt)).limit(limit);

    return rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      status: r.status as any,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
      error: r.error,
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps || [],
    }));
  }

  /**
   * Retrieves a single run record.
   */
  async getRun(runId: string): Promise<AutomationRun | null> {
    await ensureDatabaseReady();
    const rows = await db.select().from(automationRuns).where(eq(automationRuns.id, runId)).limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      jobId: r.jobId,
      status: r.status as any,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result,
      error: r.error,
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps || [],
    };
  }

  /**
   * Lists pending approval items for background tasks.
   */
  async listApprovals(): Promise<AutomationApproval[]> {
    await ensureDatabaseReady();
    const rows = await db
      .select()
      .from(automationApprovals)
      .where(eq(automationApprovals.status, 'PENDING'))
      .orderBy(desc(automationApprovals.createdAt));

    return rows.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      runId: r.runId,
      actionId: r.actionId,
      actionType: r.actionType,
      reason: r.reason,
      requestedAction: typeof r.requestedAction === 'string' ? JSON.parse(r.requestedAction) : r.requestedAction || {},
      status: r.status as any,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
    }));
  }

  /**
   * Resolves a pending automation approval.
   */
  async handleApproval(approvalId: string, approve: boolean): Promise<boolean> {
    await ensureDatabaseReady();
    const rows = await db
      .select()
      .from(automationApprovals)
      .where(eq(automationApprovals.id, approvalId))
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Approval record ${approvalId} not found.`);
    }

    const item = rows[0];
    const newStatus = approve ? 'APPROVED' : 'DENIED';

    await db
      .update(automationApprovals)
      .set({ status: newStatus })
      .where(eq(automationApprovals.id, approvalId));

    // Update associated run
    await db
      .update(automationRuns)
      .set({
        status: approve ? 'COMPLETED' : 'FAILED',
        completedAt: new Date().toISOString(),
        error: approve ? undefined : 'Action rejected by human administrator.',
      })
      .where(eq(automationRuns.id, item.runId));

    // Update job status
    const job = await this.getJob(item.jobId);
    if (job) {
      await db
        .update(automationJobs)
        .set({
          status: 'SCHEDULED',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(automationJobs.id, job.id));
    }

    return true;
  }
}

export const automationEngine = AutomationEngine.getInstance();
