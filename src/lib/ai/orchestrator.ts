import { ChatMessage, ProviderId, ToolCall } from './types';
import { OrchestrationStep } from '@/types/orchestrator';
import { centralAssistant } from '../agents/assistant';
import { HumanApprovalPayload } from '../agents/types';

export type { OrchestrationStep };

export interface OrchestrationResponse {
  answer: string;
  steps: OrchestrationStep[];
  approvalRequest?: HumanApprovalPayload;
  agentUsed?: string;
}

/**
 * Legacy Intent Detection utility preserved for backwards compatibility with Stage 2 test suites.
 * Production orchestration uses CentralAssistant with native function calling.
 */
export function detectToolIntent(query: string): { toolName: string; args: Record<string, unknown> } | null {
  const lower = query.toLowerCase();

  if (
    lower.includes('find opportunity') ||
    lower.includes('find opportunities') ||
    lower.includes('suitable for me') ||
    lower.includes('search job') ||
    lower.includes('search jobs') ||
    lower.includes('job match') ||
    lower.includes('what jobs')
  ) {
    return { toolName: 'discover_opportunities', args: { query } };
  }

  if (lower.includes('skill gap') || lower.includes('gap analysis') || lower.includes('skill match')) {
    let targetRole = 'Senior AI Engineer';
    if (lower.includes('architect')) targetRole = 'AI Systems Architect';
    if (lower.includes('full-stack') || lower.includes('full stack')) targetRole = 'Senior Full-Stack Engineer';
    return { toolName: 'analyze_skill_gap', args: { targetRole, jobDescriptionText: query } };
  }

  if (lower.includes('job description') || lower.includes('analyze job') || lower.includes('jd analysis') || lower.includes('responsibilities:')) {
    return { toolName: 'analyze_job_description', args: { jobDescriptionText: query } };
  }

  if (lower.includes('generate proposal') || lower.includes('draft proposal') || lower.includes('cover letter') || lower.includes('write proposal')) {
    return {
      toolName: 'generate_proposal',
      args: {
        companyName: 'Nexus Cognitive Lab',
        roleTitle: 'Senior AI Systems Engineer',
        keyRequirements: query,
      },
    };
  }

  if (lower.includes('mock interview') || lower.includes('interview me') || lower.includes('practice interview')) {
    let category = 'ai_systems';
    if (lower.includes('behavioral') || lower.includes('star')) category = 'behavioral_star';
    if (lower.includes('architecture') || lower.includes('system')) category = 'technical_architecture';
    return { toolName: 'start_mock_interview', args: { category, difficulty: 'senior' } };
  }

  return null;
}

/**
 * Executes Central Farhan AI Assistant Orchestration:
 * Evaluates request via native LLM tool calling, executes specialized agent tools,
 * enforces human-in-the-loop policies, and returns synthesized response.
 */
export async function runOrchestrator(
  messages: ChatMessage[],
  providerId?: ProviderId,
  options: {
    isHumanApproved?: boolean;
    approvedToolCall?: ToolCall;
  } = {}
): Promise<OrchestrationResponse> {
  const result = await centralAssistant.processRequest(messages, {
    providerId,
    isHumanApproved: options.isHumanApproved,
    approvedToolCall: options.approvedToolCall,
  });

  return {
    answer: result.answer,
    steps: result.steps,
    approvalRequest: result.approvalRequest,
    agentUsed: result.agentUsed,
  };
}
