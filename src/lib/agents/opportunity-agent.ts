import { z } from 'zod';
import { Agent } from './types';
import { defaultOpportunityPipeline } from '../opportunities/pipeline';
import { runOpportunityScan, getMonitoredAlerts } from '../scanner/monitor';

export const OpportunityAgent: Agent = {
  id: 'opportunity_agent',
  name: 'Opportunity Agent',
  description: "Discovers, evaluates, and monitors tech career opportunities matched against Farhan's verified skillset and preferences.",
  capabilities: [
    'opportunity_discovery',
    'opportunity_matching',
    'automated_scanning',
    'alert_monitoring',
  ],
  tools: [
    {
      name: 'discover_opportunities',
      description: "Find, rank, and match high-quality tech career opportunities suited to Farhan's verified skills, target roles, and remote work preferences.",
      agentId: 'opportunity_agent',
      inputSchema: z.object({
        query: z.string().optional().describe('Optional keyword or focus area (e.g. "AI Systems", "TypeScript", "Staff Developer")'),
        role: z.string().optional().describe('Target role title filter'),
        roleQuery: z.string().optional().describe('Target role or keyword query'),
        workModel: z.enum(['remote', 'hybrid', 'on-site']).optional().describe('Preferred work model'),
      }),
      execute: async (input) => {
        try {
          const pipelineResults = await defaultOpportunityPipeline.executePipeline({
            query: input.roleQuery || input.query,
            role: input.role || input.roleQuery,
            workModel: input.workModel,
          });

          return {
            toolName: 'discover_opportunities',
            success: true,
            data: {
              opportunities: pipelineResults,
              count: pipelineResults.length,
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Opportunity discovery failed';
          return {
            toolName: 'discover_opportunities',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'scan_opportunities',
      description: 'Trigger a background opportunity scan to detect new qualified roles matching Farhan and persist alerts in the database.',
      agentId: 'opportunity_agent',
      inputSchema: z.object({
        minMatchThreshold: z.number().min(50).max(100).optional().default(85).describe('Minimum match score percentage (50-100)'),
      }),
      execute: async (input) => {
        const result = await runOpportunityScan(input.minMatchThreshold);
        return {
          toolName: 'scan_opportunities',
          success: true,
          data: result,
        };
      },
    },
    {
      name: 'get_monitored_alerts',
      description: 'Retrieve all current monitored job alerts and notifications from the database.',
      agentId: 'opportunity_agent',
      inputSchema: z.object({}),
      execute: async () => {
        const alerts = getMonitoredAlerts();
        return {
          toolName: 'get_monitored_alerts',
          success: true,
          data: alerts,
        };
      },
    },
  ],
};

export const opportunityAgent = OpportunityAgent;

