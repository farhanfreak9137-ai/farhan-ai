export interface OrchestrationStep {
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'approval_required';
  title: string;
  details?: string;
  data?: unknown;
  step?: 'intent_resolution' | 'tool_execution' | 'approval_requested' | 'synthesis' | string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}
