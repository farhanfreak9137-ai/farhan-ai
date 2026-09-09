// src/lib/agents/automation-agent.ts
import { z } from 'zod';
import { Agent } from './types';
import { automationEngine } from '@/lib/automation/engine';
import { TaskType, JobType } from '@/lib/automation/types';

export const AutomationAgent: Agent = {
  id: 'automation_agent',
  name: 'Automation Agent',
  description:
    'Manages persistent background automations, scheduled workflows, periodic research, opportunity watchers, and system summaries with strict policy boundaries and approval queues.',
  capabilities: [
    'automation_management',
    'scheduled_jobs',
    'opportunity_monitoring',
    'research_monitoring',
    'workflow_monitoring',
    'system_summaries',
  ],
  tools: [
    {
      name: 'create_automation',
      description:
        'Create and persist a new safe background automation job (e.g. daily job search, weekly research, workflow check). Consequential external actions are halted for human approval.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        name: z.string().min(1).describe('Descriptive name of the automation job'),
        description: z.string().optional().describe('Optional detailed explanation of what this automation does'),
        type: z.enum(['interval', 'cron', 'once']).describe('Schedule type: "interval" (ms), "cron" (cron string), or "once" (timestamp)'),
        schedule: z.string().describe('Schedule definition (e.g. "60000" for 60s, "0 9 * * *" for daily at 9am, or ISO date)'),
        taskType: z.enum([
          'opportunity_monitor',
          'research_monitor',
          'workflow_monitor',
          'personal_summary',
          'custom',
        ]).describe('The automation task category'),
        taskPayload: z.record(z.string(), z.unknown()).default({}).describe('Parameters for the task (e.g. search keywords, target role, company)'),
        enabled: z.boolean().optional().default(true).describe('Whether the automation is initially active'),
      }),
      execute: async (input) => {
        try {
          const job = await automationEngine.createJob({
            name: input.name,
            description: input.description,
            type: input.type as JobType,
            schedule: input.schedule,
            taskType: input.taskType as TaskType,
            taskPayload: input.taskPayload,
            enabled: input.enabled,
          });

          return {
            toolName: 'create_automation',
            success: true,
            data: { job },
          };
        } catch (err: any) {
          return {
            toolName: 'create_automation',
            success: false,
            error: err.message || 'Failed to create automation job',
          };
        }
      },
    },

    {
      name: 'list_automations',
      description: 'List all configured background automation jobs, their schedules, next run times, and statuses.',
      agentId: 'automation_agent',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const jobs = await automationEngine.listJobs();
          return {
            toolName: 'list_automations',
            success: true,
            data: { automations: jobs, count: jobs.length },
          };
        } catch (err: any) {
          return {
            toolName: 'list_automations',
            success: false,
            error: err.message || 'Failed to list automations',
          };
        }
      },
    },

    {
      name: 'get_automation',
      description: 'Retrieve detailed information about a specific automation job by its unique ID.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        id: z.string().describe('Unique ID of the automation job'),
      }),
      execute: async (input) => {
        try {
          const job = await automationEngine.getJob(input.id);
          if (!job) {
            return {
              toolName: 'get_automation',
              success: false,
              error: `Automation job ${input.id} not found`,
            };
          }
          return {
            toolName: 'get_automation',
            success: true,
            data: { job },
          };
        } catch (err: any) {
          return {
            toolName: 'get_automation',
            success: false,
            error: err.message || 'Failed to retrieve automation',
          };
        }
      },
    },

    {
      name: 'update_automation',
      description: 'Update the name, schedule, parameters, or status of an existing automation job.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        id: z.string().describe('Unique ID of the automation job to update'),
        name: z.string().optional().describe('New name'),
        description: z.string().optional().describe('New description'),
        schedule: z.string().optional().describe('New schedule string'),
        taskPayload: z.record(z.string(), z.unknown()).optional().describe('Updated payload parameters'),
        enabled: z.boolean().optional().describe('Enable or disable job'),
      }),
      execute: async (input) => {
        try {
          const job = await automationEngine.updateJob(input.id, {
            name: input.name,
            description: input.description,
            schedule: input.schedule,
            taskPayload: input.taskPayload,
            enabled: input.enabled,
          });

          return {
            toolName: 'update_automation',
            success: true,
            data: { job },
          };
        } catch (err: any) {
          return {
            toolName: 'update_automation',
            success: false,
            error: err.message || 'Failed to update automation',
          };
        }
      },
    },

    {
      name: 'pause_automation',
      description: 'Pause a scheduled automation job so it does not run until resumed.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        id: z.string().describe('Unique ID of the automation job to pause'),
      }),
      execute: async (input) => {
        try {
          const job = await automationEngine.pauseJob(input.id);
          return {
            toolName: 'pause_automation',
            success: true,
            data: { job },
          };
        } catch (err: any) {
          return {
            toolName: 'pause_automation',
            success: false,
            error: err.message || 'Failed to pause automation',
          };
        }
      },
    },

    {
      name: 'resume_automation',
      description: 'Resume a paused automation job and reschedule its next execution.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        id: z.string().describe('Unique ID of the automation job to resume'),
      }),
      execute: async (input) => {
        try {
          const job = await automationEngine.resumeJob(input.id);
          return {
            toolName: 'resume_automation',
            success: true,
            data: { job },
          };
        } catch (err: any) {
          return {
            toolName: 'resume_automation',
            success: false,
            error: err.message || 'Failed to resume automation',
          };
        }
      },
    },

    {
      name: 'cancel_automation',
      description: 'Cancel an automation job permanently, preventing future scheduled executions.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        id: z.string().describe('Unique ID of the automation job to cancel'),
      }),
      execute: async (input) => {
        try {
          const job = await automationEngine.cancelJob(input.id);
          return {
            toolName: 'cancel_automation',
            success: true,
            data: { job },
          };
        } catch (err: any) {
          return {
            toolName: 'cancel_automation',
            success: false,
            error: err.message || 'Failed to cancel automation',
          };
        }
      },
    },

    {
      name: 'run_automation_now',
      description: 'Immediately trigger execution of an automation job out of schedule.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        id: z.string().describe('Unique ID of the automation job to run immediately'),
      }),
      execute: async (input) => {
        try {
          await automationEngine.runJobNow(input.id);
          return {
            toolName: 'run_automation_now',
            success: true,
            data: { message: `Job ${input.id} triggered successfully.` },
          };
        } catch (err: any) {
          return {
            toolName: 'run_automation_now',
            success: false,
            error: err.message || 'Failed to trigger job',
          };
        }
      },
    },

    {
      name: 'get_automation_run',
      description: 'Retrieve execution details and step traces for a specific automation run ID.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        runId: z.string().describe('Unique run ID to look up'),
      }),
      execute: async (input) => {
        try {
          const run = await automationEngine.getRun(input.runId);
          if (!run) {
            return {
              toolName: 'get_automation_run',
              success: false,
              error: `Run ${input.runId} not found`,
            };
          }
          return {
            toolName: 'get_automation_run',
            success: true,
            data: { run },
          };
        } catch (err: any) {
          return {
            toolName: 'get_automation_run',
            success: false,
            error: err.message || 'Failed to retrieve run',
          };
        }
      },
    },

    {
      name: 'list_automation_runs',
      description: 'List execution history for a specific automation job or all background jobs.',
      agentId: 'automation_agent',
      inputSchema: z.object({
        jobId: z.string().optional().describe('Optional job ID to filter execution history'),
        limit: z.number().min(1).max(100).optional().default(20).describe('Max runs to return'),
      }),
      execute: async (input) => {
        try {
          const runs = await automationEngine.listRuns(input.jobId, input.limit);
          return {
            toolName: 'list_automation_runs',
            success: true,
            data: { runs, count: runs.length },
          };
        } catch (err: any) {
          return {
            toolName: 'list_automation_runs',
            success: false,
            error: err.message || 'Failed to list runs',
          };
        }
      },
    },
  ],
};
