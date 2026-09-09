// src/lib/automation/types.ts

export type JobStatus =
  | 'DISABLED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSED';

export type JobType = 'interval' | 'cron' | 'once';

export type TaskType =
  | 'opportunity_monitor'
  | 'research_monitor'
  | 'workflow_monitor'
  | 'personal_summary'
  | 'custom';

export type AutomationPolicyLevel = 'SAFE_BACKGROUND' | 'REQUIRES_APPROVAL' | 'DENIED';

export interface AutomationPolicyDecision {
  level: AutomationPolicyLevel;
  allowed: boolean;
  reason?: string;
  requiredApprovalAction?: string;
}

export interface AutomationJob {
  id: string;
  name: string;
  description?: string;
  type: JobType;
  schedule: string;
  status: JobStatus;
  enabled: boolean;
  taskType: TaskType;
  taskPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastResult?: unknown;
  failureCount: number;
}

export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_APPROVAL' | 'CANCELLED';

export interface AutomationRunStep {
  step: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_for_approval';
  details?: string;
  timestamp: string;
}

export interface AutomationRun {
  id: string;
  jobId: string;
  status: RunStatus;
  startedAt: string;
  completedAt?: string | null;
  result?: unknown;
  error?: string | null;
  steps?: AutomationRunStep[];
}

export interface AutomationApproval {
  id: string;
  jobId: string;
  runId: string;
  actionId?: string | null;
  actionType: string;
  reason: string;
  requestedAction: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED';
  createdAt: string;
  expiresAt?: string | null;
}

export interface CreateJobInput {
  name: string;
  description?: string;
  type: JobType;
  schedule: string;
  taskType: TaskType;
  taskPayload: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateJobInput {
  name?: string;
  description?: string;
  schedule?: string;
  type?: JobType;
  taskType?: TaskType;
  taskPayload?: Record<string, unknown>;
  enabled?: boolean;
}
