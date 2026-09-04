import { ToolExecutionResult } from '@/types/tools';

async function callToolApi(toolName: string, args: Record<string, unknown> = {}): Promise<ToolExecutionResult> {
  try {
    const res = await fetch('/api/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName, args }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        toolName,
        success: false,
        error: errData.error || `HTTP error ${res.status}`,
      };
    }

    return await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return {
      toolName,
      success: false,
      error: msg,
    };
  }
}

export async function executeDiscoverOpportunities(params: {
  query?: string;
  role?: string;
  workModel?: string;
}): Promise<ToolExecutionResult> {
  return callToolApi('discover_opportunities', params);
}

export async function executeAnalyzeJobDescription(params: {
  jobDescriptionText: string;
  companyName?: string;
  jobTitle?: string;
}): Promise<ToolExecutionResult> {
  return callToolApi('analyze_job_description', params);
}

export async function executeAnalyzeSkillGap(params: {
  targetRole: string;
  requiredSkills?: string;
  jobDescriptionText?: string;
}): Promise<ToolExecutionResult> {
  return callToolApi('analyze_skill_gap', params);
}

export async function executeGenerateProposal(params: {
  companyName: string;
  roleTitle: string;
  keyRequirements?: string;
}): Promise<ToolExecutionResult> {
  return callToolApi('generate_proposal', params);
}

export async function executeStartMockInterview(params: {
  category: string;
  difficulty?: string;
}): Promise<ToolExecutionResult> {
  return callToolApi('start_mock_interview', params);
}

export async function executeEvaluateInterviewAnswer(params: {
  question: string;
  userAnswer: string;
}): Promise<ToolExecutionResult> {
  return callToolApi('evaluate_interview_answer', params);
}
