import type { AgentRegistry } from '../agents/registry';
import {
  Workflow,
  WorkflowStep,
  WorkflowDefinition,
  WorkflowStepExecutionContext,
} from './types';
import {
  createWorkflowRecord,
  getWorkflowRecord,
  updateWorkflowRecord,
  saveWorkflowStepRecord,
} from './persistence';
import { ApprovalRequiredError, WorkflowCancelledError } from './errors';

export interface ExecuteOptions {
  isHumanApproved?: boolean;
  registry?: AgentRegistry;
}

export class WorkflowExecutor {
  private customRegistry?: AgentRegistry;
  private cancelledWorkflowIds: Set<string> = new Set();

  constructor(registry?: AgentRegistry) {
    this.customRegistry = registry;
  }

  private async getRegistry(): Promise<AgentRegistry> {
    if (this.customRegistry) return this.customRegistry;
    const { defaultRegistry } = await import('../agents/registry');
    return defaultRegistry;
  }

  public cancel(workflowId: string): void {
    this.cancelledWorkflowIds.add(workflowId);
  }

  /**
   * Initializes and executes a workflow from step 0.
   */
  public async execute(
    definition: WorkflowDefinition,
    input: unknown,
    options: ExecuteOptions = {}
  ): Promise<Workflow> {
    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const plannedSteps: WorkflowStep[] = definition.steps.map((s, idx) => ({
      id: s.id,
      workflowId,
      stepIndex: idx,
      name: s.name,
      status: 'pending',
      agent: s.agent,
      tool: s.tool,
    }));

    const workflow: Workflow = {
      id: workflowId,
      type: definition.type,
      status: 'running',
      currentStep: 0,
      currentStepIndex: 0,
      steps: plannedSteps,
      input,
      context:
        typeof input === 'object' && input !== null && 'context' in input
          ? ((input as any).context as Record<string, unknown>)
          : {},
      createdAt: now,
      updatedAt: now,
    };

    // Save initial checkpoint
    await createWorkflowRecord(workflow);

    return this.runFromCheckpoint(workflow, definition, options);
  }

  /**
   * Resumes a paused, failed, or waiting-for-approval workflow from its last valid checkpoint.
   */
  public async resume(
    workflowId: string,
    definition: WorkflowDefinition,
    options: ExecuteOptions = {}
  ): Promise<Workflow> {
    const existing = await getWorkflowRecord(workflowId);
    if (!existing) {
      throw new Error(`Workflow with ID '${workflowId}' not found for resumption.`);
    }

    if (existing.status === 'completed') {
      return existing;
    }

    // Reset error state if resuming from failed
    existing.status = 'running';
    existing.error = undefined;
    existing.updatedAt = new Date().toISOString();
    await updateWorkflowRecord(existing);

    return this.runFromCheckpoint(existing, definition, options);
  }

  /**
   * Core sequential step execution loop with checkpointing.
   */
  private async runFromCheckpoint(
    workflow: Workflow,
    definition: WorkflowDefinition,
    options: ExecuteOptions
  ): Promise<Workflow> {
    const steps = workflow.steps;
    let isHumanApproved = Boolean(options.isHumanApproved);
    const registry = options.registry || (await this.getRegistry());

    if (!workflow.context) {
      workflow.context = {};
    }

    for (let i = workflow.currentStep; i < definition.steps.length; i++) {
      // Check cancellation request
      if (this.cancelledWorkflowIds.has(workflow.id)) {
        workflow.status = 'cancelled';
        workflow.updatedAt = new Date().toISOString();
        await updateWorkflowRecord(workflow);
        this.cancelledWorkflowIds.delete(workflow.id);
        return workflow;
      }

      const stepDef = definition.steps[i];
      const stepRecord = steps[i];

      workflow.currentStep = i;
      workflow.currentStepIndex = i;
      stepRecord.status = 'running';
      stepRecord.startedAt = new Date().toISOString();

      // Checkpoint running step
      await updateWorkflowRecord(workflow);
      await saveWorkflowStepRecord(stepRecord);

      const previousCompletedSteps = steps.slice(0, i).filter((s) => s.status === 'completed');

      const context: WorkflowStepExecutionContext = {
        workflowId: workflow.id,
        workflowType: workflow.type,
        stepIndex: i,
        stepId: stepRecord.id,
        stepName: stepRecord.name,
        workflowInput: workflow.input,
        previousSteps: previousCompletedSteps,
        stepInput: stepRecord.input,
        registry,
        isHumanApproved,
        approvalPayload: workflow.approvalPayload,
        checkCancellation: () => this.cancelledWorkflowIds.has(workflow.id),
      };

      try {
        // Execute step
        const stepOutput = await stepDef.execute(context);

        stepRecord.status = 'completed';
        stepRecord.output = stepOutput;
        stepRecord.completedAt = new Date().toISOString();
        await saveWorkflowStepRecord(stepRecord);

        // Accumulate step output into workflow context
        if (stepOutput && typeof stepOutput === 'object') {
          Object.assign(workflow.context, stepOutput);
        }

        // Reset approval flag for subsequent steps unless re-authorized
        isHumanApproved = false;
      } catch (err: unknown) {
        // Handle explicit approval boundary halt
        if (err instanceof ApprovalRequiredError) {
          stepRecord.status = 'waiting_for_approval';
          stepRecord.error = err.message;
          await saveWorkflowStepRecord(stepRecord);

          workflow.status = 'waiting_for_approval';
          workflow.approvalPayload = err.payload;
          workflow.updatedAt = new Date().toISOString();
          await updateWorkflowRecord(workflow);

          return workflow;
        }

        // Handle cancellation
        if (err instanceof WorkflowCancelledError) {
          stepRecord.status = 'failed';
          stepRecord.error = 'Step cancelled by user';
          await saveWorkflowStepRecord(stepRecord);

          workflow.status = 'cancelled';
          workflow.updatedAt = new Date().toISOString();
          await updateWorkflowRecord(workflow);
          return workflow;
        }

        // Handle failure: preserve completed steps and record error
        const errMsg = err instanceof Error ? err.message : 'Step execution error';
        console.error(`[WorkflowExecutor] Step ${i} ('${stepDef.name}') failed:`, err);

        stepRecord.status = 'failed';
        stepRecord.error = errMsg;
        stepRecord.completedAt = new Date().toISOString();
        await saveWorkflowStepRecord(stepRecord);

        workflow.status = 'failed';
        workflow.error = errMsg;
        workflow.updatedAt = new Date().toISOString();
        await updateWorkflowRecord(workflow);

        return workflow;
      }
    }

    // All steps completed successfully
    workflow.status = 'completed';
    workflow.currentStep = definition.steps.length;
    workflow.currentStepIndex = definition.steps.length;
    workflow.output = steps[steps.length - 1]?.output;
    workflow.updatedAt = new Date().toISOString();
    await updateWorkflowRecord(workflow);

    return workflow;
  }
}

export const defaultWorkflowExecutor = new WorkflowExecutor();
