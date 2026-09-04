import { Agent, AgentTool, AgentExecutionContext } from './types';
import { ToolDeclaration, ToolParameterProperty } from '../ai/types';
import { ToolExecutionResult } from '@/types/tools';
import { z } from 'zod';
import { CareerAgent } from './career-agent';
import { OpportunityAgent } from './opportunity-agent';
import { ResearchAgent } from './research-agent';
import { MemoryAgent } from './memory-agent';
import { WorkflowAgent } from './workflow-agent';
import { KnowledgeAgent } from './knowledge-agent';
import { ComputerControlAgent } from './computer-control-agent';
import { AutomationAgent } from './automation-agent';
import { SystemAgent } from './system-agent';

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, Agent> = new Map();
  private tools: Map<string, AgentTool> = new Map();

  public constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Registers a specialized agent and indexes its tools.
   */
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    for (const tool of agent.tools) {
      if (!tool.inputSchema && (tool as any).parameters) {
        tool.inputSchema = (tool as any).parameters;
      }
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Alias for registerAgent to support idiomatic registry.register(agent).
   */
  public register(agent: Agent): void {
    this.registerAgent(agent);
  }

  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Translates registered tools into native LLM tool/function declarations.
   */
  public getToolsForLLM(): ToolDeclaration[] {
    return Array.from(this.tools.values()).map((tool) => {
      const properties: Record<string, ToolParameterProperty> = {};
      const required: string[] = [];

      const schema = tool.inputSchema || (tool as any).parameters;

      // Extract properties from Zod schema if available
      if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        for (const [key, fieldSchema] of Object.entries(shape)) {
          let field = fieldSchema as z.ZodTypeAny;
          let isOptional = false;

          if (field instanceof z.ZodOptional || field instanceof z.ZodDefault) {
            isOptional = true;
            field = (field as any)._def.innerType || field;
          }

          let type = 'string';
          let enumValues: string[] | undefined = undefined;

          if (field instanceof z.ZodString) {
            type = 'string';
          } else if (field instanceof z.ZodNumber) {
            type = 'number';
          } else if (field instanceof z.ZodBoolean) {
            type = 'boolean';
          } else if (field instanceof z.ZodEnum) {
            type = 'string';
            const def = (field as any)._def;
            enumValues = Array.isArray(def?.values) ? def.values : Array.isArray((field as any).options) ? (field as any).options : undefined;
          }

          let items: { type: string } | undefined = undefined;
          if (field instanceof z.ZodArray) {
            type = 'array';
            items = { type: 'string' };
          }

          properties[key] = {
            type,
            description: (field.description || `Parameter ${key}`),
            ...(items ? { items: items as any } : {}),
            ...(enumValues ? { enum: enumValues } : {}),
          };

          if (!isOptional) {
            required.push(key);
          }
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      };
    });
  }

  /**
   * Executes a tool with schema validation and strict human approval enforcement.
   */
  public async executeTool(
    name: string,
    rawArgs: unknown,
    context: AgentExecutionContext = {}
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        toolName: name,
        success: false,
        error: `Unknown tool '${name}' requested. Registered tools: ${Array.from(this.tools.keys()).join(', ')}`,
      };
    }

    const schema = tool.inputSchema || (tool as any).parameters;
    let validatedArgs = rawArgs as any;

    // 1. Schema Validation via Zod
    if (schema && typeof schema.safeParse === 'function') {
      const validation = schema.safeParse(rawArgs);
      if (!validation.success) {
        const formattedErrors = validation.error.issues
          .map((i: any) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        return {
          toolName: name,
          success: false,
          error: `Validation error for tool '${name}': ${formattedErrors}`,
        };
      }
      validatedArgs = validation.data;
    }

    // 2. Strict Human Approval Enforcement Policy
    // Mutating tools NEVER execute directly from an unapproved LLM tool call
    const isProtected = Boolean(tool.requiresHumanApproval || tool.isMutation);
    if (isProtected && !context.isHumanApproved) {
      const approvalPayload = tool.buildApprovalPayload
        ? tool.buildApprovalPayload(validatedArgs, context)
        : {
            actionType: 'create_application' as const,
            title: `Action Authorization Required: ${name}`,
            description: `The assistant requested to execute protected mutation '${name}'. User approval is required.`,
            payload: validatedArgs,
          };

      return {
        toolName: name,
        success: true,
        requiresHumanApproval: true,
        approvalPayload,
        data: {
          pendingAction: name,
          requiresHumanApproval: true,
          message: `Action '${name}' requires explicit human approval before execution.`,
        },
      };
    }

    // 3. Authorized Tool Execution
    try {
      return await tool.execute(validatedArgs, context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tool execution failed';
      console.error(`Error executing tool '${name}':`, err);
      return {
        toolName: name,
        success: false,
        error: `Tool '${name}' execution error: ${msg}`,
      };
    }
  }
}

/**
 * Initializes and populates the default registry with core agents.
 */
export function initializeAgentRegistry(): AgentRegistry {
  const registry = AgentRegistry.getInstance();
  registry.registerAgent(CareerAgent);
  registry.registerAgent(OpportunityAgent);
  registry.registerAgent(ResearchAgent);
  registry.registerAgent(MemoryAgent);
  registry.registerAgent(WorkflowAgent);
  registry.registerAgent(KnowledgeAgent);
  registry.registerAgent(ComputerControlAgent);
  registry.registerAgent(AutomationAgent);
  registry.registerAgent(SystemAgent);
  return registry;
}

// Global auto-initialized default registry singleton
export const defaultRegistry = initializeAgentRegistry();
