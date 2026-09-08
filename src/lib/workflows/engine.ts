import { Workflow, WorkflowDefinition } from './types';
import { defaultWorkflowRegistry, WorkflowRegistry } from './registry';
import { defaultWorkflowExecutor, WorkflowExecutor } from './executor';
import { getWorkflowRecord, listWorkflowRecords, updateWorkflowRecord } from './persistence';
import { careerDiscoveryWorkflow } from './definitions/career-discovery';
import { opportunityAnalysisWorkflow } from './definitions/opportunity-analysis';
import { applicationPreparationWorkflow } from './definitions/application-preparation';

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private registry: WorkflowRegistry;
  private executor: WorkflowExecutor;

  constructor(
    registry: WorkflowRegistry = defaultWorkflowRegistry,
    executor: WorkflowExecutor = defaultWorkflowExecutor
  ) {
    this.registry = registry;
    this.executor = executor;
    this.registerBuiltInWorkflows();
  }

  public static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  private registerBuiltInWorkflows(): void {
    this.registry.registerWorkflow(careerDiscoveryWorkflow);
    this.registry.registerWorkflow(opportunityAnalysisWorkflow);
    this.registry.registerWorkflow(applicationPreparationWorkflow);
  }

  /**
   * Registers a custom workflow definition into the engine.
   */
  public registerWorkflow(definition: WorkflowDefinition): void {
    this.registry.registerWorkflow(definition);
  }

  /**
   * Starts and executes a registered workflow from step 0.
   */
  public async startWorkflow(type: string, input: unknown, options: { isHumanApproved?: boolean } = {}): Promise<Workflow> {
    const definition = this.registry.getWorkflowDefinition(type);
    if (!definition) {
      throw new Error(`Workflow type '${type}' is not registered. Available: ${this.registry.listWorkflowDefinitions().map((w) => w.type).join(', ')}`);
    }

    // Validate input schema if defined
    let validatedInput = input;
    if (definition.inputSchema) {
      const parsed = definition.inputSchema.safeParse(input);
      if (!parsed.success) {
        throw new Error(`Input validation failed for workflow '${type}': ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
      }
      validatedInput = parsed.data;
    }

    return this.executor.execute(definition, validatedInput, options);
  }

  /**
   * Resumes a paused, failed, or waiting workflow from SQLite checkpoint.
   */
  public async resumeWorkflow(workflowId: string, options: { isHumanApproved?: boolean } = {}): Promise<Workflow> {
    const existing = await getWorkflowRecord(workflowId);
    if (!existing) {
      throw new Error(`Workflow '${workflowId}' not found.`);
    }

    const definition = this.registry.getWorkflowDefinition(existing.type);
    if (!definition) {
      throw new Error(`Workflow definition '${existing.type}' not found for workflow '${workflowId}'.`);
    }

    return this.executor.resume(workflowId, definition, options);
  }

  /**
   * Authorizes a waiting workflow and resumes execution.
   */
  public async approveWorkflowStep(workflowId: string): Promise<Workflow> {
    return this.resumeWorkflow(workflowId, { isHumanApproved: true });
  }

  /**
   * Cancels a running or paused workflow.
   */
  public async cancelWorkflow(workflowId: string): Promise<Workflow> {
    this.executor.cancel(workflowId);
    const existing = await getWorkflowRecord(workflowId);
    if (existing) {
      existing.status = 'cancelled';
      existing.updatedAt = new Date().toISOString();
      await updateWorkflowRecord(existing);
      return existing;
    }
    throw new Error(`Workflow '${workflowId}' not found.`);
  }

  /**
   * Retrieves a workflow by ID.
   */
  public async getWorkflow(workflowId: string): Promise<Workflow | null> {
    return getWorkflowRecord(workflowId);
  }

  /**
   * Lists workflow records.
   */
  public async listWorkflows(options: { limit?: number; status?: string } = {}): Promise<Workflow[]> {
    return listWorkflowRecords(options);
  }

  /**
   * Lists all available workflow types.
   */
  public getAvailableWorkflowTypes(): WorkflowDefinition[] {
    return this.registry.listWorkflowDefinitions();
  }
}

export const defaultWorkflowEngine = WorkflowEngine.getInstance();
