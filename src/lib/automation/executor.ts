// src/lib/automation/executor.ts
import { db, ensureDatabaseReady } from '@/lib/db';
import { automationRuns, automationApprovals, automationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {
  AutomationJob,
  AutomationRun,
  AutomationRunStep,
  RunStatus,
} from './types';
import { evaluateAutomationPolicy } from './policies';
import { notificationService } from '@/lib/notifications/service';
import { defaultOpportunityPipeline } from '@/lib/opportunities/pipeline';
import { resolveResearchProvider } from '@/lib/research/factory';
import { listWorkflowRecords } from '@/lib/workflows/persistence';

export interface ExecuteJobResult {
  runId: string;
  status: RunStatus;
  result?: unknown;
  error?: string;
  steps: AutomationRunStep[];
}

export class AutomationExecutor {
  /**
   * Executes a scheduled or triggered automation job.
   * Enforces server-side security policies, bounds execution resources,
   * records immutable run traces, and stops at approval boundaries.
   */
  async executeJob(job: AutomationJob): Promise<ExecuteJobResult> {
    await ensureDatabaseReady();
    const runId = uuidv4();
    const startedAt = new Date().toISOString();
    const steps: AutomationRunStep[] = [];

    const recordStep = (title: string, status: AutomationRunStep['status'], details?: string) => {
      steps.push({
        step: `step-${steps.length + 1}`,
        title,
        status,
        details,
        timestamp: new Date().toISOString(),
      });
    };

    // Initialize run record in SQLite
    await db.insert(automationRuns).values({
      id: runId,
      jobId: job.id,
      status: 'RUNNING',
      startedAt,
      steps,
    });

    recordStep('Policy Evaluation', 'running', `Evaluating policy for task ${job.taskType}`);

    // 1. Evaluate Automation Policy
    const policyDecision = evaluateAutomationPolicy(job.taskType, job.taskPayload);

    if (policyDecision.level === 'DENIED') {
      const errorMsg = policyDecision.reason || 'Task denied by automation security policy.';
      recordStep('Policy Evaluation', 'failed', errorMsg);

      await db
        .update(automationRuns)
        .set({
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          error: errorMsg,
          steps,
        })
        .where(eq(automationRuns.id, runId));

      await notificationService.createNotification({
        type: 'ERROR',
        title: `Automation Denied: ${job.name}`,
        message: errorMsg,
        data: { jobId: job.id, runId },
      });

      return { runId, status: 'FAILED', error: errorMsg, steps };
    }

    if (policyDecision.level === 'REQUIRES_APPROVAL') {
      const approvalId = uuidv4();
      const reason = policyDecision.reason || 'Consequential action requires explicit human approval.';
      recordStep('Approval Boundary', 'waiting_for_approval', reason);

      // Persist to approval queue
      await db.insert(automationApprovals).values({
        id: approvalId,
        jobId: job.id,
        runId,
        actionType: policyDecision.requiredApprovalAction || 'CONSEQUENTIAL_ACTION',
        reason,
        requestedAction: job.taskPayload,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      });

      // Update run status
      await db
        .update(automationRuns)
        .set({
          status: 'WAITING_FOR_APPROVAL',
          completedAt: new Date().toISOString(),
          result: { approvalId, reason, taskPayload: job.taskPayload },
          steps,
        })
        .where(eq(automationRuns.id, runId));

      // Notify user of required approval
      await notificationService.createNotification({
        type: 'APPROVAL_REQUIRED',
        title: `Approval Required: ${job.name}`,
        message: `${reason} Please review in the Automation or Computer dashboard.`,
        data: { jobId: job.id, runId, approvalId },
      });

      return {
        runId,
        status: 'WAITING_FOR_APPROVAL',
        result: { approvalId, reason },
        steps,
      };
    }

    // 2. Execute SAFE_BACKGROUND Task
    recordStep('Policy Evaluation', 'completed', 'Classified as SAFE_BACKGROUND');
    recordStep('Execution', 'running', `Executing task ${job.taskType}`);

    try {
      let taskResult: any = null;

      switch (job.taskType) {
        case 'opportunity_monitor': {
          const query = (job.taskPayload.query as string) || 'AI Systems Engineer';
          const role = (job.taskPayload.role as string) || query;
          const opportunities = await defaultOpportunityPipeline.executePipeline({
            query,
            role,
            workModel: job.taskPayload.workModel as any,
          });

          taskResult = {
            count: opportunities.length,
            topOpportunity: opportunities[0]?.title || null,
            opportunities: opportunities.slice(0, 5),
          };

          await notificationService.createNotification({
            type: 'INFO',
            title: `Opportunity Monitor: ${job.name}`,
            message: `Discovered ${opportunities.length} matching opportunities for "${query}".`,
            data: { count: opportunities.length },
          });
          break;
        }

        case 'research_monitor': {
          const query = (job.taskPayload.query as string) || 'Next.js React Architecture';
          const provider = resolveResearchProvider();
          const searchData = await provider.search(query, { maxResults: 3 });

          taskResult = {
            query,
            sourcesCount: searchData.sources.length,
            summary: searchData.summary,
            sources: searchData.sources,
          };

          await notificationService.createNotification({
            type: 'INFO',
            title: `Research Monitor: ${job.name}`,
            message: `Completed automated research on "${query}" (${searchData.sources.length} sources).`,
            data: { query, sourcesCount: searchData.sources.length },
          });
          break;
        }

        case 'workflow_monitor': {
          const allWorkflows = await listWorkflowRecords({ limit: 10 });
          const waiting = allWorkflows.filter((w) => w.status === 'waiting_for_approval');
          const failed = allWorkflows.filter((w) => w.status === 'failed');
          const completed = allWorkflows.filter((w) => w.status === 'completed');

          taskResult = {
            total: allWorkflows.length,
            waitingCount: waiting.length,
            failedCount: failed.length,
            completedCount: completed.length,
          };

          await notificationService.createNotification({
            type: waiting.length > 0 ? 'WARNING' : 'INFO',
            title: `Workflow Monitor: ${job.name}`,
            message: `Workflows: ${waiting.length} waiting approval, ${failed.length} failed, ${completed.length} completed.`,
            data: taskResult,
          });
          break;
        }

        case 'personal_summary': {
          const allWorkflows = await listWorkflowRecords({ limit: 5 });
          const waiting = allWorkflows.filter((w) => w.status === 'waiting_for_approval');

          taskResult = {
            generatedAt: new Date().toISOString(),
            status: 'All systems operational',
            pendingApprovalsCount: waiting.length,
          };

          await notificationService.createNotification({
            type: 'SUCCESS',
            title: `Daily Summary: ${job.name}`,
            message: `System summary complete. ${waiting.length} items awaiting review.`,
            data: taskResult,
          });
          break;
        }

        case 'custom': {
          const prompt = (job.taskPayload.prompt as string) || 'Summarize current career readiness';
          const { centralAssistant } = await import('@/lib/agents/assistant');
          const assistantRes = await centralAssistant.processRequest(prompt);

          taskResult = {
            answer: assistantRes.answer,
            steps: assistantRes.steps,
            agentUsed: assistantRes.agentUsed,
          };

          await notificationService.createNotification({
            type: 'INFO',
            title: `Automation Task Completed: ${job.name}`,
            message: assistantRes.answer.slice(0, 160) + (assistantRes.answer.length > 160 ? '...' : ''),
            data: { answer: assistantRes.answer },
          });
          break;
        }

        default:
          throw new Error(`Unsupported task type: ${job.taskType}`);
      }

      recordStep('Execution', 'completed', 'Task execution finished successfully');

      const completedAt = new Date().toISOString();
      await db
        .update(automationRuns)
        .set({
          status: 'COMPLETED',
          completedAt,
          result: taskResult,
          steps,
        })
        .where(eq(automationRuns.id, runId));

      return {
        runId,
        status: 'COMPLETED',
        result: taskResult,
        steps,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Execution failed unexpectedly';
      recordStep('Execution', 'failed', errorMsg);

      await db
        .update(automationRuns)
        .set({
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          error: errorMsg,
          steps,
        })
        .where(eq(automationRuns.id, runId));

      await notificationService.createNotification({
        type: 'ERROR',
        title: `Automation Failed: ${job.name}`,
        message: errorMsg,
        data: { jobId: job.id, runId },
      });

      return {
        runId,
        status: 'FAILED',
        error: errorMsg,
        steps,
      };
    }
  }
}

export const defaultAutomationExecutor = new AutomationExecutor();
