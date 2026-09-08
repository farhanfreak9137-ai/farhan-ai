import { WorkflowDefinition } from './types';

export class WorkflowRegistry {
  private static instance: WorkflowRegistry;
  private workflows: Map<string, WorkflowDefinition> = new Map();

  public constructor() {}

  public static getInstance(): WorkflowRegistry {
    if (!WorkflowRegistry.instance) {
      WorkflowRegistry.instance = new WorkflowRegistry();
    }
    return WorkflowRegistry.instance;
  }

  public registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.type, definition);
  }

  public getWorkflowDefinition(type: string): WorkflowDefinition | undefined {
    return this.workflows.get(type);
  }

  public listWorkflowDefinitions(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }

  public clear(): void {
    this.workflows.clear();
  }
}

export const defaultWorkflowRegistry = WorkflowRegistry.getInstance();
