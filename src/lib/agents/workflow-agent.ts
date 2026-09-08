import { z } from 'zod';
import { Agent, AgentTool } from './types';
import { defaultWorkflowEngine } from '../workflows/engine';

export const WorkflowAgent: Agent = {
  id: 'workflow_agent',
  name: 'Workflow Agent',
  description:
    'Coordinates and executes autonomous multi-step career workflows including discovery, deep opportunity analysis, and application preparation with deterministic step checkpointing and human approval boundaries.',
  capabilities: [
    'workflow_execution',
    'career_discovery_workflow',
    'opportunity_analysis_workflow',
    'application_preparation_workflow',
    'workflow_checkpointing',
    'workflow_resumption',
  ],
  tools: [
    {
      name: 'start_career_workflow',
      description:
        'Start an autonomous multi-step career workflow. Supported workflow types: career_discovery (find and research top matching opportunities), opportunity_analysis (deep JD breakdown, company & tech research, strategic fit), application_preparation (prepare tailored proposal and staged application requiring human authorization).',
      agentId: 'workflow_agent',
      inputSchema: z.object({
        workflowType: z
          .enum(['career_discovery', 'opportunity_analysis', 'application_preparation'])
          .describe('The type of workflow to run'),
        input: z
          .record(z.string(), z.any())
          .describe('Input payload for the workflow, such as query, opportunity, or target role details'),
      }),
      execute: async (args, context) => {
        try {
          const workflow = await defaultWorkflowEngine.startWorkflow(
            args.workflowType,
            args.input,
            { isHumanApproved: context?.isHumanApproved }
          );

          return {
            toolName: 'start_career_workflow',
            success: true,
            data: {
              workflowId: workflow.id,
              type: workflow.type,
              status: workflow.status,
              currentStepIndex: workflow.currentStepIndex,
              totalSteps: workflow.steps.length,
              steps: workflow.steps.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
                error: s.error,
              })),
              context: workflow.context,
              error: workflow.error,
              requiresHumanApproval: workflow.status === 'waiting_for_approval',
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'start_career_workflow',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'get_workflow_status',
      description:
        'Check the status, step execution history, and current checkpoint of an autonomous career workflow by ID.',
      agentId: 'workflow_agent',
      inputSchema: z.object({
        workflowId: z.string().describe('The unique workflow ID to check'),
      }),
      execute: async (args) => {
        try {
          const workflow = await defaultWorkflowEngine.getWorkflow(args.workflowId);
          if (!workflow) {
            return {
              toolName: 'get_workflow_status',
              success: false,
              error: `Workflow with ID '${args.workflowId}' not found.`,
            };
          }

          return {
            toolName: 'get_workflow_status',
            success: true,
            data: {
              workflowId: workflow.id,
              type: workflow.type,
              status: workflow.status,
              currentStepIndex: workflow.currentStepIndex,
              steps: workflow.steps,
              context: workflow.context,
              error: workflow.error,
              createdAt: workflow.createdAt,
              updatedAt: workflow.updatedAt,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'get_workflow_status',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'resume_career_workflow',
      description:
        'Resume a paused, waiting, or failed career workflow. Use this when human approval is granted to proceed past an approval boundary or after resolving a recoverable condition.',
      agentId: 'workflow_agent',
      inputSchema: z.object({
        workflowId: z.string().describe('The workflow ID to resume'),
        isHumanApproved: z
          .boolean()
          .optional()
          .describe('True if user explicitly approved a waiting action'),
      }),
      execute: async (args, context) => {
        try {
          const isApproved =
            args.isHumanApproved !== undefined
              ? args.isHumanApproved
              : Boolean(context?.isHumanApproved);

          const workflow = await defaultWorkflowEngine.resumeWorkflow(args.workflowId, {
            isHumanApproved: isApproved,
          });

          return {
            toolName: 'resume_career_workflow',
            success: true,
            data: {
              workflowId: workflow.id,
              type: workflow.type,
              status: workflow.status,
              currentStepIndex: workflow.currentStepIndex,
              steps: workflow.steps.map((s) => ({
                id: s.id,
                name: s.name,
                status: s.status,
                error: s.error,
              })),
              context: workflow.context,
              error: workflow.error,
              requiresHumanApproval: workflow.status === 'waiting_for_approval',
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'resume_career_workflow',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'cancel_career_workflow',
      description: 'Cancel an actively executing or waiting career workflow.',
      agentId: 'workflow_agent',
      inputSchema: z.object({
        workflowId: z.string().describe('The workflow ID to cancel'),
      }),
      execute: async (args) => {
        try {
          const workflow = await defaultWorkflowEngine.cancelWorkflow(args.workflowId);
          return {
            toolName: 'cancel_career_workflow',
            success: true,
            data: {
              workflowId: workflow.id,
              status: workflow.status,
              message: `Workflow '${workflow.id}' cancelled successfully.`,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            toolName: 'cancel_career_workflow',
            success: false,
            error: msg,
          };
        }
      },
    },
  ],
};
