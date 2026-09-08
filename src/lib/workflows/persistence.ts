import { eq, desc } from 'drizzle-orm';
import { db, ensureDatabaseReady } from '@/lib/db';
import { workflows as workflowsTable, workflowSteps as workflowStepsTable } from '@/lib/db/schema';
import { Workflow, WorkflowStep, WorkflowSchema } from './types';

/**
 * Persists a newly initiated workflow and its planned steps into SQLite.
 */
export async function createWorkflowRecord(workflow: any): Promise<void> {
  await ensureDatabaseReady();

  // Normalize input and context if undefined
  if (workflow.input === undefined) {
    workflow.input = workflow.context ? { context: workflow.context } : {};
  } else if (workflow.context && typeof workflow.input === 'object' && workflow.input !== null) {
    (workflow.input as any).context = workflow.context;
  }

  if (workflow.currentStep === undefined && workflow.currentStepIndex !== undefined) {
    workflow.currentStep = workflow.currentStepIndex;
  }
  if (workflow.currentStepIndex === undefined && workflow.currentStep !== undefined) {
    workflow.currentStepIndex = workflow.currentStep;
  }

  // Validate with Zod before persistence
  const parsed = WorkflowSchema.parse(workflow);

  await db.insert(workflowsTable).values({
    id: parsed.id,
    type: parsed.type,
    status: parsed.status,
    currentStep: parsed.currentStep,
    input: parsed.input as any,
    output: parsed.output as any,
    error: parsed.error as any,
    approvalPayload: parsed.approvalPayload as any,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  });

  // Insert initial steps with collision-proof workflow-scoped IDs
  if (parsed.steps && parsed.steps.length > 0) {
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      const stepId = step.id.includes(parsed.id) ? step.id : `${parsed.id}-${step.id}`;

      await db
        .insert(workflowStepsTable)
        .values({
          id: stepId,
          workflowId: parsed.id,
          stepIndex: i,
          name: step.name,
          status: step.status,
          agent: step.agent || null,
          tool: step.tool || null,
          input: step.input as any,
          output: step.output as any,
          error: step.error || null,
          startedAt: step.startedAt || null,
          completedAt: step.completedAt || null,
        })
        .onConflictDoUpdate({
          target: workflowStepsTable.id,
          set: {
            status: step.status,
            output: step.output as any,
            error: step.error || null,
            startedAt: step.startedAt || null,
            completedAt: step.completedAt || null,
          },
        });
    }
  }
}

/**
 * Retrieves a workflow by ID along with all associated sequential steps.
 */
export async function getWorkflowRecord(id: string): Promise<Workflow | null> {
  await ensureDatabaseReady();

  const workflowRows = await db
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.id, id))
    .limit(1);

  if (workflowRows.length === 0) {
    return null;
  }

  const row = workflowRows[0];

  const stepRows = await db
    .select()
    .from(workflowStepsTable)
    .where(eq(workflowStepsTable.workflowId, id))
    .orderBy(workflowStepsTable.stepIndex);

  const steps: WorkflowStep[] = stepRows.map((s) => ({
    id: s.id.startsWith(`${id}-`) ? s.id.substring(id.length + 1) : s.id,
    workflowId: s.workflowId,
    stepIndex: s.stepIndex,
    name: s.name,
    status: s.status as any,
    agent: s.agent || undefined,
    tool: s.tool || undefined,
    input: s.input,
    output: s.output,
    error: s.error || undefined,
    startedAt: s.startedAt || undefined,
    completedAt: s.completedAt || undefined,
  }));

  const rawInput = row.input as any;
  const context =
    rawInput?.context !== undefined
      ? rawInput.context
      : typeof rawInput === 'object' && rawInput !== null
      ? rawInput
      : {};

  let effectiveInput = rawInput;
  if (rawInput && typeof rawInput === 'object') {
    const { context: _ctx, ...rest } = rawInput;
    if (Object.keys(rest).length > 0) {
      effectiveInput = rest;
    }
  }

  return {
    id: row.id,
    type: row.type,
    status: row.status as any,
    currentStep: row.currentStep,
    currentStepIndex: row.currentStep,
    steps,
    input: effectiveInput,
    context,
    output: row.output || undefined,
    error: (row.error as any) || undefined,
    approvalPayload: row.approvalPayload || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Updates an existing workflow record in SQLite.
 */
export async function updateWorkflowRecord(workflow: Partial<Workflow> & { id: string }): Promise<void> {
  await ensureDatabaseReady();

  const updates: Record<string, any> = {
    updatedAt: new Date().toISOString(),
  };

  if (workflow.status !== undefined) updates.status = workflow.status;
  if (workflow.currentStepIndex !== undefined) updates.currentStep = workflow.currentStepIndex;
  else if (workflow.currentStep !== undefined) updates.currentStep = workflow.currentStep;
  if (workflow.output !== undefined) updates.output = workflow.output;
  if (workflow.error !== undefined) updates.error = workflow.error;
  if (workflow.context !== undefined) {
    let baseInput = (workflow.input as any) || {};
    if (!workflow.input || Object.keys(baseInput).length === 0) {
      const existingRows = await db
        .select({ input: workflowsTable.input })
        .from(workflowsTable)
        .where(eq(workflowsTable.id, workflow.id))
        .limit(1);
      if (existingRows.length > 0 && existingRows[0].input) {
        baseInput = existingRows[0].input;
      }
    }
    updates.input = {
      ...baseInput,
      context: workflow.context,
    };
  }

  await db
    .update(workflowsTable)
    .set(updates)
    .where(eq(workflowsTable.id, workflow.id));
}

/**
 * Updates or persists an individual step execution checkpoint.
 */
export async function saveWorkflowStepRecord(
  stepOrWorkflowId: WorkflowStep | string,
  maybeStep?: WorkflowStep
): Promise<void> {
  await ensureDatabaseReady();

  let step: WorkflowStep;
  let workflowId: string;

  if (typeof stepOrWorkflowId === 'string' && maybeStep) {
    workflowId = stepOrWorkflowId;
    step = maybeStep;
  } else {
    step = stepOrWorkflowId as WorkflowStep;
    workflowId = step.workflowId!;
  }

  const stepId = step.id.includes(workflowId) ? step.id : `${workflowId}-${step.id}`;

  await db
    .insert(workflowStepsTable)
    .values({
      id: stepId,
      workflowId,
      stepIndex: step.stepIndex || 0,
      name: step.name,
      status: step.status,
      agent: step.agent || null,
      tool: step.tool || null,
      input: step.input as any,
      output: step.output as any,
      error: step.error || null,
      startedAt: step.startedAt || null,
      completedAt: step.completedAt || null,
    })
    .onConflictDoUpdate({
      target: workflowStepsTable.id,
      set: {
        status: step.status,
        output: step.output as any,
        error: step.error || null,
        startedAt: step.startedAt || null,
        completedAt: step.completedAt || null,
      },
    });
}

/**
 * Lists workflows with optional filtering and limit.
 */
export async function listWorkflowRecords(options: { limit?: number; status?: string } = {}): Promise<Workflow[]> {
  await ensureDatabaseReady();

  const limit = options.limit || 50;
  const rows = await db
    .select()
    .from(workflowsTable)
    .orderBy(desc(workflowsTable.createdAt))
    .limit(limit);

  const workflows: Workflow[] = [];

  for (const row of rows) {
    if (options.status && row.status !== options.status) {
      continue;
    }

    const stepRows = await db
      .select()
      .from(workflowStepsTable)
      .where(eq(workflowStepsTable.workflowId, row.id))
      .orderBy(workflowStepsTable.stepIndex);

    const rawInput = row.input as any;
    const context =
      rawInput?.context !== undefined
        ? rawInput.context
        : typeof rawInput === 'object' && rawInput !== null
        ? rawInput
        : {};

    workflows.push({
      id: row.id,
      type: row.type,
      status: row.status as any,
      currentStep: row.currentStep,
      currentStepIndex: row.currentStep,
      steps: stepRows.map((s) => ({
        id: s.id.startsWith(`${row.id}-`) ? s.id.substring(row.id.length + 1) : s.id,
        workflowId: s.workflowId,
        stepIndex: s.stepIndex,
        name: s.name,
        status: s.status as any,
        agent: s.agent || undefined,
        tool: s.tool || undefined,
        input: s.input,
        output: s.output,
        error: s.error || undefined,
        startedAt: s.startedAt || undefined,
        completedAt: s.completedAt || undefined,
      })),
      input: rawInput,
      context,
      output: row.output || undefined,
      error: (row.error as any) || undefined,
      approvalPayload: row.approvalPayload || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  return workflows;
}
