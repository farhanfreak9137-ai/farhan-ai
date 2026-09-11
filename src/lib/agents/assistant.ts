import { ChatMessage, ProviderId, ToolCall, LLMProvider } from '../ai/types';
import { OrchestrationStep } from '@/types/orchestrator';
import { AgentRegistry, defaultRegistry } from './registry';
import { HumanApprovalPayload } from './types';
import { resolveProvider } from '../ai/factory';
import { buildSystemPromptAsync } from '../ai/prompts';
import { tryFastPathRoute } from './fastPathRouter';

export interface AssistantResponse {
  answer: string;
  steps: OrchestrationStep[];
  approvalRequest?: HumanApprovalPayload;
  pendingToolCall?: ToolCall;
  agentUsed?: string;
  providerUsed?: ProviderId;
}

export interface AssistantProcessOptions {
  providerId?: ProviderId;
  provider?: LLMProvider;
  isHumanApproved?: boolean;
  approvedToolCall?: ToolCall;
  maxIterations?: number;
}

export class CentralAssistant {
  private registry: AgentRegistry;
  private defaultProvider?: LLMProvider;

  constructor(registry: AgentRegistry = defaultRegistry, provider?: LLMProvider) {
    this.registry = registry;
    this.defaultProvider = provider;
  }

  /**
   * Main conversational orchestrator:
   * 1. Evaluates user message.
   * 2. Uses native LLM function/tool calling with dynamic discovery from AgentRegistry.
   * 3. Intercepts mutating actions behind server-side human approval policies.
   * 4. Executes sequential multi-step tool calls if requested by the LLM.
   * 5. Synthesizes structured results into natural conversational answers.
   */
  public async processRequest(
    messages: ChatMessage[] | string,
    options: AssistantProcessOptions = {}
  ): Promise<AssistantResponse> {
    let provider = options.provider || this.defaultProvider || resolveProvider(options.providerId);
    const steps: OrchestrationStep[] = [];
    const maxIterations = options.maxIterations || 5;

    // Load fresh system prompt grounded in Farhan's SQLite profile and memories
    const systemPrompt = await buildSystemPromptAsync();

    // Dynamically query available tools from AgentRegistry (Zero hardcoding!)
    const toolsForLLM = this.registry.getToolsForLLM();

    const normalizedMessages: ChatMessage[] =
      typeof messages === 'string'
        ? [{ role: 'user', content: messages }]
        : messages;

    // 0-Token Offline Fast-Path Interceptor:
    // Directly executes OS and local computer commands in <50ms without invoking LLM APIs
    if (!options.isHumanApproved) {
      const lastUserMsg = [...normalizedMessages].reverse().find((m) => m.role === 'user')?.content;
      if (lastUserMsg && typeof lastUserMsg === 'string') {
        const fastResult = await tryFastPathRoute(lastUserMsg);
        if (fastResult.matched) {
          return {
            answer: fastResult.answer || 'Action completed successfully.',
            steps: fastResult.steps || [],
            agentUsed: 'System Agent (Offline Fast-Path)',
            providerUsed: 'local_fastpath',
          };
        }
      }
    }

    let activeMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...normalizedMessages.filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'tool'),
    ];

    // Handle pre-approved tool execution if user just authorized a pending action
    if (options.isHumanApproved && options.approvedToolCall) {
      const toolCall = options.approvedToolCall;
      steps.push({
        type: 'reasoning',
        step: 'intent_resolution',
        status: 'completed',
        title: 'User Authorization Verified',
        details: `Executing authorized action: ${toolCall.name}`,
      });

      steps.push({
        type: 'tool_call',
        step: 'tool_execution',
        status: 'running',
        title: `Executing: ${toolCall.name}`,
        data: toolCall.arguments,
      });

      const execResult = await this.registry.executeTool(
        toolCall.name,
        toolCall.arguments,
        { isHumanApproved: true, providerId: options.providerId }
      );

      steps.push({
        type: 'tool_result',
        step: 'tool_execution',
        status: execResult.success ? 'completed' : 'failed',
        title: `Executed ${toolCall.name}`,
        data: execResult.data,
      });

      activeMessages.push({
        role: 'assistant',
        content: null as any,
        toolCalls: [toolCall],
      });

      activeMessages.push({
        role: 'tool',
        name: toolCall.name,
        toolCallId: toolCall.id,
        content: JSON.stringify(execResult.data || execResult.error),
      });
    }

    let iterations = 0;
    let finalAnswer = '';
    let approvalRequest: HumanApprovalPayload | undefined = undefined;
    let primaryAgentUsed: string | undefined = undefined;

    while (iterations < maxIterations) {
      iterations++;

      // Check if provider supports native function/tool calling
      if (!provider.chatWithTools) {
        // Fallback: direct response without tools
        finalAnswer = await provider.chat(activeMessages, { temperature: 0.2 });
        break;
      }

      let response;
      try {
        response = await provider.chatWithTools(activeMessages, toolsForLLM, {
          temperature: 0.2,
        });
      } catch (err: unknown) {
        console.warn(`[Assistant] Provider ${provider.id} chatWithTools failed:`, err instanceof Error ? err.message : err);
        if (provider.id === 'gemini' && process.env.OPENAI_API_KEY) {
          try {
            console.log('[Assistant] Falling back to OpenAI provider...');
            provider = resolveProvider('openai');
            response = await provider.chatWithTools!(activeMessages, toolsForLLM, {
              temperature: 0.2,
            });
          } catch (openaiErr: unknown) {
            console.warn('[Assistant] OpenAI fallback failed, falling back to mock:', openaiErr instanceof Error ? openaiErr.message : openaiErr);
            provider = resolveProvider('mock');
            response = await provider.chatWithTools!(activeMessages, toolsForLLM, {
              temperature: 0.2,
            });
          }
        } else if (provider.id !== 'mock') {
          provider = resolveProvider('mock');
          response = await provider.chatWithTools!(activeMessages, toolsForLLM, {
            temperature: 0.2,
          });
        } else {
          finalAnswer = await provider.chat(activeMessages, { temperature: 0.2 });
          break;
        }
      }

      // If the model did NOT request any tool calls, it has answered directly or finished synthesis
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalAnswer = response.content || '';
        if (steps.length === 0) {
          steps.push({
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Direct Conversational Response',
            details: 'No tool invocation required for this request.',
          });
        }
        break;
      }

      // The model requested one or more native tool calls
      for (const call of response.toolCalls) {
        const toolMeta = this.registry.getTool(call.name);
        const agent = toolMeta?.agentId ? this.registry.getAgent(toolMeta.agentId) : undefined;
        if (agent && !primaryAgentUsed) {
          primaryAgentUsed = agent.name;
        }

        steps.push({
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: `Delegating to ${agent?.name || 'Specialized Agent'}: ${call.name}`,
          details: `Requested tool: ${call.name} (${JSON.stringify(call.arguments)}) (Agent: ${agent?.name || 'Registry'})`,
        });

        steps.push({
          type: 'tool_call',
          step: 'tool_execution',
          status: 'running',
          title: `Invoking: ${call.name}`,
          details: JSON.stringify(call.arguments, null, 2),
          data: call.arguments,
        });

        // Execute tool through registry (enforces Zod input validation & human approval policy)
        const toolResult = await this.registry.executeTool(call.name, call.arguments, {
          providerId: options.providerId,
          isHumanApproved: false,
        });

        // If mutating action requires explicit human approval, halt execution
        if (toolResult.requiresHumanApproval && toolResult.approvalPayload) {
          approvalRequest = toolResult.approvalPayload;
          steps.push({
            type: 'approval_required',
            step: 'approval_requested',
            status: 'pending',
            title: 'Human Authorization Safeguard',
            details: toolResult.approvalPayload.description,
            data: toolResult.approvalPayload,
          });

          return {
            answer: `I have prepared the action for **${call.name}**. Before proceeding with changes, your explicit authorization is required.`,
            steps,
            approvalRequest,
            pendingToolCall: call,
            agentUsed: primaryAgentUsed,
            providerUsed: provider.id,
          };
        }

        // Record execution outcome
        steps.push({
          type: 'tool_result',
          step: 'tool_execution',
          status: toolResult.success ? 'completed' : 'failed',
          title: `Result from ${call.name}`,
          data: toolResult.data || toolResult.error,
        });

        // Append assistant tool call and tool result to message history for synthesis
        activeMessages.push({
          role: 'assistant',
          content: response.content || '',
          toolCalls: [call],
          rawModelParts: response.rawModelParts,
        });

        activeMessages.push({
          role: 'tool',
          name: call.name,
          toolCallId: call.id,
          content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error }),
        });
      }
    }

    if (steps.some((s) => s.type === 'tool_call')) {
      steps.push({
        type: 'reasoning',
        step: 'synthesis',
        status: 'completed',
        title: 'Synthesizing response grounded in tool data',
        details: 'Grounded in verified candidate records and tool outputs.',
      });
    }

    return {
      answer: finalAnswer,
      steps,
      approvalRequest,
      agentUsed: primaryAgentUsed,
      providerUsed: provider.id,
    };
  }

  /**
   * Ergonomic alias for processRequest with optional provider parameter.
   */
  public async run(
    messages: ChatMessage[],
    providerOrOptions?: LLMProvider | AssistantProcessOptions,
    maybeOptions?: AssistantProcessOptions
  ): Promise<AssistantResponse> {
    let options: AssistantProcessOptions = {};
    if (providerOrOptions && typeof (providerOrOptions as any).chat === 'function') {
      options = { ...maybeOptions, provider: providerOrOptions as LLMProvider };
    } else if (providerOrOptions) {
      options = providerOrOptions as AssistantProcessOptions;
    }
    return this.processRequest(messages, options);
  }
}

export const centralAssistant = new CentralAssistant();
