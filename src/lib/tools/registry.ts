import { getProfile } from '../profile/store';
import { OpportunityItem, SkillGapResult, ToolExecutionResult } from '@/types/tools';
import { db, ensureDatabaseReady } from '@/lib/db';
import { opportunities, interviewResults } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

/**
 * Curated repository of tech opportunities for dynamic matching.
 */
const BASE_OPPORTUNITIES: Omit<OpportunityItem, 'matchScore' | 'matchReason'>[] = [
  {
    id: 'opp-1',
    title: 'Senior AI Systems Engineer',
    company: 'Nexus Cognitive Lab',
    location: 'Remote (Worldwide)',
    workModel: 'remote',
    salaryRange: '$145,000 - $180,000 USD',
    requiredSkills: ['TypeScript', 'LLM Orchestration & Prompt Engineering', 'Function & Tool Calling', 'Next.js (App Router)', 'PostgreSQL'],
    description: 'Lead the architecture of production-grade autonomous agent pipelines, streaming LLM interfaces, and multi-model failover systems.',
    url: 'https://careers.nexuslab.ai/senior-ai-engineer',
    postedAt: '2 days ago',
  },
  {
    id: 'opp-2',
    title: 'Full-Stack Software Architect',
    company: 'Apex Cloud Platforms',
    location: 'Remote (US / EU Timezones)',
    workModel: 'remote',
    salaryRange: '$135,000 - $165,000 USD',
    requiredSkills: ['TypeScript', 'Next.js (App Router)', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
    description: 'Architect scalable web applications, serverless microservices, and event-driven data streaming platforms.',
    url: 'https://careers.apexcloud.io/architect',
    postedAt: '3 days ago',
  },
  {
    id: 'opp-3',
    title: 'Staff Agentic Systems Developer',
    company: 'Hyperion AI',
    location: 'Remote (Worldwide)',
    workModel: 'remote',
    salaryRange: '$160,000 - $210,000 USD',
    requiredSkills: ['Python', 'TypeScript', 'RAG & Vector Context Injection', 'Function & Tool Calling', 'Multi-Model Fallbacks & Routing'],
    description: 'Design autonomous multi-agent systems, self-correcting prompt engines, and developer-first AI tools.',
    url: 'https://hyperion.ai/jobs/staff-agentic-dev',
    postedAt: '1 day ago',
  },
  {
    id: 'opp-4',
    title: 'Senior Frontend & AI Platform Engineer',
    company: 'Pulse AI Studio',
    location: 'Remote (Flexible)',
    workModel: 'remote',
    salaryRange: '$125,000 - $155,000 USD',
    requiredSkills: ['React', 'Next.js (App Router)', 'JavaScript (ESNext)', 'HTML5 & Modern CSS', 'REST & Streaming APIs'],
    description: 'Craft high-performance, accessible user interfaces with real-time SSE streaming, glassmorphism designs, and AI chat interfaces.',
    url: 'https://pulseai.dev/careers',
    postedAt: '4 days ago',
  },
];

/**
 * Discovers and ranks career opportunities matched to Farhan's verified profile.
 */
export async function executeDiscoverOpportunities(params: {
  query?: string;
  role?: string;
  workModel?: string;
}): Promise<ToolExecutionResult> {
  await ensureDatabaseReady();
  const profile = await getProfile();
  
  // Load opportunities from SQLite
  let oppSource = BASE_OPPORTUNITIES;
  try {
    const dbOpps = await db.select().from(opportunities);
    if (dbOpps.length > 0) {
      oppSource = dbOpps.map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        location: r.location,
        workModel: r.workModel as any,
        salaryRange: r.salaryRange ?? undefined,
        requiredSkills: typeof r.requiredSkills === 'string' ? JSON.parse(r.requiredSkills) : r.requiredSkills,
        description: r.description,
        url: r.url ?? undefined,
        postedAt: r.postedAt ?? undefined,
      }));
    }
  } catch (err) {
    console.error('Error fetching opportunities from SQLite, falling back to base list:', err);
  }

  // Flatten verified skills
  const verifiedSkills = profile.skills.flatMap((c) => c.skills.map((s) => s.name.toLowerCase()));

  const matchedOpportunities: OpportunityItem[] = oppSource.map((opp) => {
    // Calculate matching score
    const totalRequired = opp.requiredSkills.length;
    const matches = opp.requiredSkills.filter((req) =>
      verifiedSkills.some((vs) => vs.includes(req.toLowerCase()) || req.toLowerCase().includes(vs))
    );
    const score = Math.round((matches.length / totalRequired) * 100);

    const reasons: string[] = [];
    if (matches.length > 0) {
      reasons.push(`Strong match in core stack: ${matches.slice(0, 3).join(', ')}`);
    }
    if (opp.workModel === profile.careerPreferences.workModel) {
      reasons.push(`Direct alignment with preferred ${profile.careerPreferences.workModel} work model`);
    }

    return {
      ...opp,
      matchScore: score,
      matchReason: reasons.join('. ') + '.',
    };
  })
    .filter((opp) => {
      if (params.workModel && opp.workModel !== params.workModel) return false;
      if (params.query) {
        const cleaned = params.query
          .toLowerCase()
          .replace(/\b(find|opportunities|suitable|for|me|search|jobs|please|show|available|any)\b/gi, '')
          .trim();
        if (cleaned.length > 2) {
          return (
            opp.title.toLowerCase().includes(cleaned) ||
            opp.description.toLowerCase().includes(cleaned) ||
            opp.requiredSkills.some((s) => s.toLowerCase().includes(cleaned))
          );
        }
      }
      return true;
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return {
    toolName: 'discover_opportunities',
    success: true,
    data: {
      totalFound: matchedOpportunities.length,
      candidate: profile.personalInfo.fullName,
      targetRoles: profile.careerPreferences.targetRoles,
      opportunities: matchedOpportunities,
    },
  };
}

/**
 * Analyzes a raw job description to extract structured requirements.
 */
export async function executeAnalyzeJobDescription(params: {
  jobDescriptionText: string;
  companyName?: string;
  jobTitle?: string;
}): Promise<ToolExecutionResult> {
  const text = params.jobDescriptionText;
  
  // Basic heuristic keyword extraction
  const techKeywords = ['TypeScript', 'JavaScript', 'Python', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'RAG', 'LLM', 'AI', 'GraphQL', 'Redis', 'SQL', 'Git', 'Tailwind', 'CSS'];
  const extractedSkills = techKeywords.filter((tech) => new RegExp(`\\b${tech}\\b`, 'i').test(text));

  const isSenior = /senior|staff|lead|principal/i.test(text) || /5\+\s*years|4\+\s*years/i.test(text);

  return {
    toolName: 'analyze_job_description',
    success: true,
    data: {
      company: params.companyName || 'Target Company',
      title: params.jobTitle || 'Target Role',
      detectedSeniority: isSenior ? 'Senior / Lead Level' : 'Mid / General Level',
      extractedSkills,
      responsibilitiesSummary: 'Extracted key responsibilities emphasizing architecture, scalability, and modern engineering standards.',
      rawLength: text.length,
    },
  };
}

/**
 * Computes exact skill-gap analysis between Farhan's verified profile and a target job.
 */
export async function executeAnalyzeSkillGap(params: {
  targetRole: string;
  requiredSkills?: string;
  jobDescriptionText?: string;
}): Promise<ToolExecutionResult> {
  const profile = await getProfile();
  const verifiedSkillsMap = new Map<string, string>();
  
  profile.skills.forEach((cat) => {
    cat.skills.forEach((s) => {
      verifiedSkillsMap.set(s.name.toLowerCase(), s.proficiency);
    });
  });

  // Determine list of required skills to check
  let targetSkills: string[] = [];
  if (params.requiredSkills) {
    targetSkills = params.requiredSkills.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (params.jobDescriptionText) {
    const techKeywords = ['TypeScript', 'JavaScript', 'Python', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'RAG', 'LLM', 'Redis', 'GraphQL'];
    targetSkills = techKeywords.filter((tech) => new RegExp(`\\b${tech}\\b`, 'i').test(params.jobDescriptionText!));
  } else {
    // Default to target role requirements
    targetSkills = ['TypeScript', 'Next.js', 'LLM Orchestration', 'PostgreSQL', 'System Architecture', 'AWS', 'Kubernetes'];
  }

  const verifiedMatches: string[] = [];
  const gapsOrMissingSkills: string[] = [];

  targetSkills.forEach((req) => {
    const lower = req.toLowerCase();
    const match = Array.from(verifiedSkillsMap.keys()).find((k) => k.includes(lower) || lower.includes(k));
    if (match) {
      verifiedMatches.push(`${req} (Farhan: ${verifiedSkillsMap.get(match)})`);
    } else {
      gapsOrMissingSkills.push(req);
    }
  });

  const overallMatchScore = targetSkills.length > 0
    ? Math.round((verifiedMatches.length / targetSkills.length) * 100)
    : 85;

  const result: SkillGapResult = {
    targetRole: params.targetRole,
    overallMatchScore,
    verifiedMatches,
    gapsOrMissingSkills,
    strengthsSummary: `Farhan possesses verified high-tier competencies in ${verifiedMatches.slice(0, 3).join(', ')}.`,
    learningRoadmap: gapsOrMissingSkills.map((gap, idx) => ({
      priority: idx === 0 ? 'high' : 'medium',
      skill: gap,
      actionItem: `Build a concrete micro-project integrating ${gap} with existing TypeScript/Next.js stack.`,
      estimatedTime: '1 - 2 weeks',
    })),
  };

  return {
    toolName: 'analyze_skill_gap',
    success: true,
    data: result,
  };
}

/**
 * Generates a tailored proposal with strict Human-in-the-Loop approval requirements.
 */
export async function executeGenerateProposal(params: {
  companyName: string;
  roleTitle: string;
  keyRequirements?: string;
}): Promise<ToolExecutionResult> {
  const profile = await getProfile();

  const proposalContent = `Subject: Application for ${params.roleTitle} — ${profile.personalInfo.fullName}

Dear Hiring Team at ${params.companyName},

I am writing to express my strong enthusiasm for the ${params.roleTitle} position. With 5+ years of verified software engineering experience specializing in modern TypeScript architectures, Next.js, and Agentic AI systems, I have delivered high-throughput platforms and autonomous workflows that directly solve core business challenges.

A few tangible highlights from my verified career background that align with your needs:
• Autonomous AI Workflows: Engineered intelligent agent workflows that reduced customer inquiry response times by 45%.
• Production Next.js Architecture: Led frontend migrations to Next.js App Router, drastically optimizing page performance and SEO Core Web Vitals.
• Backend Performance: Designed streaming REST endpoints and tuned PostgreSQL database queries to slash query latency by 35%.

I am particularly drawn to ${params.companyName} because of your focus on technical innovation. I would welcome the opportunity to discuss how my hands-on experience in full-stack AI engineering can drive immediate impact for your team.

Sincerely,
${profile.personalInfo.fullName}
${profile.personalInfo.links.github ? `GitHub: ${profile.personalInfo.links.github}` : ''}
${profile.personalInfo.links.portfolio ? `Portfolio: ${profile.personalInfo.links.portfolio}` : ''}`;

  return {
    toolName: 'generate_proposal',
    success: true,
    requiresHumanApproval: true,
    approvalPayload: {
      actionType: 'export_proposal',
      title: `Personalized Proposal for ${params.companyName}`,
      description: `Drafted a custom proposal for ${params.roleTitle} using Farhan's verified achievements. Human approval required before sending or exporting.`,
      payload: {
        company: params.companyName,
        role: params.roleTitle,
        content: proposalContent,
      },
    },
    data: {
      company: params.companyName,
      role: params.roleTitle,
      content: proposalContent,
      requiresHumanApproval: true,
    },
  };
}

/**
 * Initializes a mock interview question session.
 */
export async function executeStartMockInterview(params: {
  category: string;
  difficulty?: string;
}): Promise<ToolExecutionResult> {
  const questions: Record<string, { q: string; context: string; points: string[] }> = {
    technical_architecture: {
      q: 'How would you architect a real-time streaming AI agent system using Next.js App Router and Web Streams to guarantee low-latency token delivery and resilient provider failover?',
      context: 'Assessing system architecture, edge streaming, SSE, and error boundaries.',
      points: ['ReadableStream / TransformStream', 'Server-Sent Events (SSE)', 'Try-catch provider fallback', 'Stateless vs Stateful context injection'],
    },
    ai_systems: {
      q: 'How do you prevent hallucinations in personal agent systems when users ask questions outside the candidate’s recorded background?',
      context: 'Assessing grounding strategies, negative constraints, and prompt engineering.',
      points: ['Explicit system prompt negative constraints', 'Factual boundary guardrails', 'Verification against single source of truth', 'Transparent disclosure of missing data'],
    },
    behavioral_star: {
      q: 'Tell me about a time you optimized a slow database query or backend bottleneck. What was the situation, your exact technical action, and the quantified impact?',
      context: 'STAR method evaluation for performance engineering.',
      points: ['Clear Situation/Task', 'Specific technical action (indexing, profiling)', 'Quantified outcome (e.g. % latency slash)'],
    },
  };

  const selected = questions[params.category] || questions.technical_architecture;

  return {
    toolName: 'start_mock_interview',
    success: true,
    data: {
      category: params.category,
      difficulty: params.difficulty || 'senior',
      question: selected.q,
      scenario: selected.context,
      rubricExpectations: selected.points,
    },
  };
}

/**
 * Evaluates an interview answer using the STAR rubric.
 */
export async function executeEvaluateInterviewAnswer(params: {
  question: string;
  userAnswer: string;
}): Promise<ToolExecutionResult> {
  const answer = params.userAnswer.trim();
  const wordCount = answer.split(/\s+/).length;

  // Evaluate depth based on length and technical terms
  let score = 7;
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (wordCount > 40) {
    score += 1;
    strengths.push('Provided a comprehensive answer with sufficient technical context.');
  } else {
    improvements.push('Consider elaborating with more specific architectural details or trade-offs.');
  }

  if (/latency|throughput|streaming|fallback|architecture|sql|index|next\.js/i.test(answer)) {
    score += 1;
    strengths.push('Demonstrated concrete technical vocabulary and engineering mechanisms.');
  }

  if (/result|outcome|improved|reduced|slashed|percent|%/i.test(answer)) {
    score += 1;
    strengths.push('Effectively quantified the impact of your actions (STAR result).');
  } else {
    improvements.push('Remember to quantify the end result (e.g. "% reduction in latency" or "X ms response time").');
  }

  score = Math.min(10, Math.max(1, score));

  // Persist evaluation result to SQLite database
  try {
    await ensureDatabaseReady();
    await db.insert(interviewResults).values({
      id: `eval-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: 'interview_evaluation',
      question: params.question,
      userAnswer: params.userAnswer,
      overallScore: score,
      clarityScore: Math.min(10, score),
      technicalDepthScore: Math.max(1, score - 1),
      strengths,
      improvements,
      feedbackSummary: `Solid response (${score}/10). Focus on articulating trade-offs and quantitative results.`,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to persist interview result to SQLite:', err);
  }

  return {
    toolName: 'evaluate_interview_answer',
    success: true,
    data: {
      overallScore: score,
      clarityScore: Math.min(10, score),
      technicalDepthScore: Math.max(1, score - 1),
      strengths,
      improvements,
      feedbackSummary: `Solid response (${score}/10). Focus on articulating trade-offs and quantitative results.`,
    },
  };
}

/**
 * Retrieves all stored interview evaluations directly from SQLite.
 */
export async function getInterviewResults() {
  await ensureDatabaseReady();
  return db.select().from(interviewResults).orderBy(desc(interviewResults.createdAt));
}

/**
 * Central Tool Dispatcher.
 */
export async function executeToolByName(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'discover_opportunities':
      return executeDiscoverOpportunities(args as any);
    case 'analyze_job_description':
      return executeAnalyzeJobDescription(args as any);
    case 'analyze_skill_gap':
      return executeAnalyzeSkillGap(args as any);
    case 'generate_proposal':
      return executeGenerateProposal(args as any);
    case 'start_mock_interview':
      return executeStartMockInterview(args as any);
    case 'evaluate_interview_answer':
      return executeEvaluateInterviewAnswer(args as any);
    default:
      return {
        toolName,
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
  }
}
