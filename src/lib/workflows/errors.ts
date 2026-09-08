export class WorkflowExecutionError extends Error {
  public readonly code: string;
  public readonly stepIndex?: number;
  public readonly details?: unknown;

  constructor(message: string, code: string = 'STEP_EXECUTION_FAILED', stepIndex?: number, details?: unknown) {
    super(message);
    this.name = 'WorkflowExecutionError';
    this.code = code;
    this.stepIndex = stepIndex;
    this.details = details;
  }
}

export class ApprovalRequiredError extends Error {
  public readonly actionType: string;
  public readonly payload: unknown;

  constructor(message: string, actionType: string, payload: unknown) {
    super(message);
    this.name = 'ApprovalRequiredError';
    this.actionType = actionType;
    this.payload = payload;
  }
}

export class WorkflowCancelledError extends Error {
  constructor(message: string = 'Workflow execution was cancelled') {
    super(message);
    this.name = 'WorkflowCancelledError';
  }
}
