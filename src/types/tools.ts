export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
  requiresHumanApproval?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  requiresHumanApproval?: boolean;
  approvalPayload?: {
    actionType: 'submit_application' | 'send_message' | 'export_proposal' | 'accept_contract' | 'create_application' | 'update_application' | string;
    title: string;
    description: string;
    payload: Record<string, unknown>;
  };
}

export interface OpportunityItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workModel: 'remote' | 'hybrid' | 'on-site';
  salaryRange?: string;
  matchScore: number; // 0-100
  matchReason: string;
  requiredSkills: string[];
  description: string;
  url?: string;
  postedAt: string;
  source?: string;
  retrievedAt?: string;
  externalId?: string;
}

export interface SkillGapResult {
  targetRole: string;
  company?: string;
  overallMatchScore: number; // 0-100
  verifiedMatches: string[];
  gapsOrMissingSkills: string[];
  strengthsSummary: string;
  learningRoadmap: {
    priority: 'high' | 'medium' | 'low';
    skill: string;
    actionItem: string;
    estimatedTime: string;
  }[];
}

export interface ProposalDraft {
  id: string;
  targetRole: string;
  company: string;
  content: string;
  verifiedHighlightsUsed: string[];
  status: 'draft' | 'approved' | 'sent' | 'rejected';
  createdAt: string;
}

export interface MockInterviewQuestion {
  id: string;
  category: 'technical_architecture' | 'ai_systems' | 'behavioral_star' | 'problem_solving';
  question: string;
  contextOrScenario?: string;
  expectedKeyPoints: string[];
}

export interface InterviewEvaluation {
  questionId: string;
  score: number; // 1-10
  clarityScore: number; // 1-10
  technicalDepthScore: number; // 1-10
  strengths: string[];
  areasForImprovement: string[];
  modelAnswerOrTip: string;
}
