import { z } from 'zod';
import { ProviderId } from '../ai/types';
import { ToolExecutionResult } from '@/types/tools';

export interface AgentExecutionContext {
  providerId?: ProviderId;
  userId?: string;
  isHumanApproved?: boolean;
  metadata?: Record<string, unknown>;
}

export interface HumanApprovalPayload {
  actionType: 'submit_application' | 'send_message' | 'export_proposal' | 'create_application' | 'update_application' | 'accept_contract' | string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
}

export interface AgentTool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  agentId?: string;
  inputSchema?: z.ZodType<TInput>;
  parameters?: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  requiresHumanApproval?: boolean;
  isMutation?: boolean;
  buildApprovalPayload?: (input: TInput, context: AgentExecutionContext) => HumanApprovalPayload;
  execute: (input: TInput, context: AgentExecutionContext) => Promise<ToolExecutionResult>;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: string[];
  readonly tools: AgentTool[];
  execute?: (request: string, context?: AgentExecutionContext) => Promise<unknown>;
}
