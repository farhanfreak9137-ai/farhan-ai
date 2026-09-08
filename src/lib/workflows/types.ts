import { z } from 'zod';
import { HumanApprovalPayload } from '../agents/types';
import { AgentRegistry } from '../agents/registry';

export type WorkflowStatus =
  | 'pending'
  | 'running'
  | 'waiting_for_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting_for_approval';

export const WorkflowErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  stepIndex: z.number().optional(),
  details: z.unknown().optional(),
});

export type WorkflowError = z.infer<typeof WorkflowErrorSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string(),
  workflowId: z.string().optional(),
  stepIndex: z.number().optional(),
  name: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'waiting_for_approval']),
  agent: z.string().optional(),
  tool: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum([
    'pending',
    'running',
    'waiting_for_approval',
    'completed',
    'failed',
    'cancelled',
  ]),
  currentStep: z.number().default(0),
  currentStepIndex: z.number().optional(),
  steps: z.array(WorkflowStepSchema),
  input: z.unknown().optional().default({}),
  output: z.unknown().optional(),
  context: z.record(z.string(), z.any()).optional().default({}),
  error: z.union([z.string(), WorkflowErrorSchema]).optional(),
  approvalPayload: z.any().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

/**
 * Execution Context provided to a workflow step handler.
 */
export interface WorkflowStepExecutionContext {
  workflowId: string;
  workflowType: string;
  stepIndex: number;
  stepId: string;
  stepName: string;
  workflowInput: unknown;
  previousSteps: WorkflowStep[];
  stepInput: unknown;
  registry: AgentRegistry;
  isHumanApproved?: boolean;
  approvalPayload?: HumanApprovalPayload;
  checkCancellation: () => boolean;
}

/**
 * Definition of a single step within a workflow.
 */
export interface WorkflowStepDefinition {
  id: string;
  name: string;
  agent?: string;
  tool?: string;
  isProtectedMutation?: boolean;
  execute: (context: WorkflowStepExecutionContext) => Promise<unknown>;
}

/**
 * Declarative definition of an entire workflow.
 */
export interface WorkflowDefinition {
  type: string;
  name: string;
  description: string;
  inputSchema?: z.ZodTypeAny;
  steps: WorkflowStepDefinition[];
}
