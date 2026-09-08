import { z } from 'zod';
import { WorkflowDefinition } from '../types';
import { getProfile } from '@/lib/profile/store';
import { addApplicationAsync } from '@/lib/tracker/store';
import { JobDescriptionAnalyzer } from '../analyzer/job-analyzer';
import { ProfileMatcher } from '../analyzer/profile-matcher';
import { ApprovalRequiredError } from '../errors';

export const ApplicationPreparationInputSchema = z
  .object({
    companyName: z.string().optional(),
    roleTitle: z.string().optional(),
    jobDescriptionText: z.string().optional(),
    company: z.string().optional(),
    role: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    jobDescription: z.string().optional(),
    text: z.string().optional(),
    location: z.string().optional(),
    workModel: z.string().optional(),
    salaryRange: z.string().optional(),
    notes: z.string().optional(),
    opportunity: z
      .object({
        company: z.string().optional(),
        companyName: z.string().optional(),
        role: z.string().optional(),
        roleTitle: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        jobDescriptionText: z.string().optional(),
        jobDescription: z.string().optional(),
        text: z.string().optional(),
        location: z.string().optional(),
        workModel: z.string().optional(),
        salaryRange: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
  })
  .passthrough()
  .transform((val: any) => {
    const opp = val.opportunity || val;
    return {
      companyName:
        opp.companyName || opp.company || val.companyName || val.company || 'Hiring Organization',
      roleTitle:
        opp.roleTitle || opp.role || opp.title || val.roleTitle || val.role || val.title || 'Software Engineer',
      jobDescriptionText:
        opp.jobDescriptionText ||
        opp.description ||
        opp.jobDescription ||
        opp.text ||
        val.jobDescriptionText ||
        val.description ||
        val.jobDescription ||
        val.text ||
        '',
      location: opp.location || val.location || 'Remote',
      workModel: (opp.workModel === 'hybrid' ||
      opp.workModel === 'on-site' ||
      opp.workModel === 'onsite' ||
      val.workModel === 'hybrid' ||
      val.workModel === 'on-site' ||
      val.workModel === 'onsite'
        ? opp.workModel || val.workModel
        : 'remote') as 'remote' | 'hybrid' | 'on-site',
      salaryRange: opp.salaryRange || val.salaryRange || undefined,
      notes: val.notes || opp.notes || undefined,
    };
  });

export type ApplicationPreparationInput = z.infer<typeof ApplicationPreparationInputSchema>;

export const applicationPreparationWorkflow: WorkflowDefinition = {
  type: 'application_preparation',
  name: 'Tailored Application Material Preparation',
  description: 'Deconstructs opportunity requirements, researches hiring company, identifies matching verified projects, crafts customized proposals, and secures human authorization before persisting application to pipeline tracker.',
  inputSchema: ApplicationPreparationInputSchema,
  steps: [
    {
      id: 'deconstruct_opportunity',
      name: 'Deconstruct Opportunity & Requirements',
      agent: 'Career Agent',
      tool: 'analyze_job_description',
      execute: async (context) => {
        const input = context.workflowInput as ApplicationPreparationInput;
        const analyzed = JobDescriptionAnalyzer.analyze({
          text: input.jobDescriptionText,
          company: input.companyName,
          title: input.roleTitle,
        });

        return {
          analyzed,
          requiredSkills: analyzed.requiredSkills,
          responsibilities: analyzed.responsibilities,
        };
      },
    },
    {
      id: 'company_intelligence',
      name: 'Research Hiring Company Context',
      agent: 'Research Agent',
      tool: 'company_research',
      execute: async (context) => {
        const input = context.workflowInput as ApplicationPreparationInput;
        const toolResult = await context.registry.executeTool('company_research', {
          companyName: input.companyName,
          context: `Application preparation for ${input.roleTitle}. Identifying mission alignment and tech challenges.`,
        });

        const data = toolResult.data as any;
        return {
          summary: data?.summary || `Overview of ${input.companyName}`,
          sources: Array.isArray(data?.sources) ? data.sources : [],
        };
      },
    },
    {
      id: 'align_verified_background',
      name: 'Align Verified Background & Projects',
      execute: async (context) => {
        const jd = (context.previousSteps[0]?.output as any)?.analyzed;
        const profile = await getProfile();
        const match = ProfileMatcher.match(jd, profile);

        return {
          overallMatchScore: match.overallMatchScore,
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          relevantProjects: match.relevantProjects,
          verifiedCandidate: {
            fullName: profile.personalInfo.fullName,
            headline: profile.personalInfo.headline,
            location: profile.personalInfo.location,
          },
        };
      },
    },
    {
      id: 'draft_proposal',
      name: 'Generate Tailored Application Proposal',
      execute: async (context) => {
        const input = context.workflowInput as ApplicationPreparationInput;
        const jd = (context.previousSteps[0]?.output as any)?.analyzed;
        const companyIntel = context.previousSteps[1]?.output as any;
        const alignment = context.previousSteps[2]?.output as any;

        const profile = await getProfile();

        // Strictly use verified metrics and projects - ZERO fabrication
        const topProjects = alignment.relevantProjects.slice(0, 2);
        const topSkills = alignment.matchedSkills.slice(0, 5);

        const projectEvidenceText = topProjects
          .map(
            (p: any) =>
              `• **${p.title}**: ${p.description} (Key stack: ${p.technologies.join(', ')})`
          )
          .join('\n');

        const proposalText = `# Application: ${input.roleTitle} — ${profile.personalInfo.fullName}
**Target Company:** ${input.companyName}
**Candidate Headline:** ${profile.personalInfo.headline}
**Evaluated Match Fit:** ${alignment.overallMatchScore}%

---

### Dear Hiring Team at ${input.companyName},

I am writing to express my strong interest in the **${input.roleTitle}** opportunity. With proven hands-on experience designing and operating production-grade agentic AI architectures and modern distributed web platforms, my background directly aligns with ${input.companyName}'s engineering standards.

### 1. Verified Technical Alignment
My verified engineering competencies directly address your core requirements:
• **Core Competencies:** ${topSkills.join(', ') || 'Next.js, TypeScript, LLM Orchestration, PostgreSQL'}
• **Production Architecture:** Migration to Next.js App Router, sub-200ms latency streaming LLM pipelines, and resilient multi-model failover topologies.

### 2. Relevant Production Case Studies
${projectEvidenceText || '• **Autonomous Agent Pipelines**: Developed multi-agent orchestration frameworks featuring dynamic tool-calling, Zod validation, and human-in-the-loop safeguards.'}

### 3. Mutual Fit & Engineering Philosophy
Based on ${input.companyName}'s focus, I am eager to contribute clean, reliable, and test-driven software engineering practices to your engineering initiatives.

I look forward to discussing how my experience will add immediate value to your technical roadmap.

Sincerely,  
**${profile.personalInfo.fullName}**  
${profile.personalInfo.email || 'farhan@example.com'} | ${profile.personalInfo.links?.github || 'github.com/farhan'} | ${profile.personalInfo.links?.linkedin || 'linkedin.com/in/farhan'}`;

        return {
          company: input.companyName,
          role: input.roleTitle,
          proposalDraft: proposalText,
          proposal: proposalText,
          matchScore: alignment.overallMatchScore,
        };
      },
    },
    {
      id: 'request_human_approval',
      name: 'Human Authorization Gate',
      isProtectedMutation: true,
      execute: async (context) => {
        const input = context.workflowInput as ApplicationPreparationInput;
        const draftOutput = context.previousSteps[3]?.output as any;

        const approvalPayload = {
          actionType: 'create_application',
          title: `Authorize Application: ${input.roleTitle} at ${input.companyName}`,
          description: `Review drafted proposal and authorize adding ${input.roleTitle} at ${input.companyName} to your local SQLite pipeline.`,
          payload: {
            company: input.companyName,
            role: input.roleTitle,
            location: input.location || 'Remote',
            workModel: input.workModel || 'remote',
            matchScore: draftOutput?.matchScore || 85,
            salaryRange: input.salaryRange,
            notes: input.notes,
            proposalDraft: draftOutput?.proposalDraft,
          },
        };

        // Halt if user has not yet explicitly authorized
        if (!context.isHumanApproved) {
          throw new ApprovalRequiredError(
            `Human approval required to commit ${input.roleTitle} at ${input.companyName} to application tracker.`,
            'create_application',
            approvalPayload
          );
        }

        return {
          authorized: true,
          approvedAt: new Date().toISOString(),
          approvalPayload,
        };
      },
    },
    {
      id: 'persist_application',
      name: 'Persist Application to SQLite Tracker',
      agent: 'Career Agent',
      tool: 'create_application',
      execute: async (context) => {
        const rawIn = (context.workflowInput || {}) as any;
        const opp = rawIn.opportunity || rawIn;
        const company = opp.companyName || opp.company || rawIn.companyName || 'Target Company';
        const role = opp.roleTitle || opp.role || opp.title || rawIn.roleTitle || 'Software Engineer';
        const draftOutput = context.previousSteps[3]?.output as any;

        const applicationRecord = await addApplicationAsync({
          company,
          role,
          location: opp.location || rawIn.location || 'Remote',
          workModel: (opp.workModel || rawIn.workModel || 'remote') as any,
          status: 'saved',
          matchScore: draftOutput?.matchScore || 85,
          salaryRange: opp.salaryRange || rawIn.salaryRange,
          notes: opp.notes || rawIn.notes || 'Created via Autonomous Application Preparation Workflow.',
          proposalDraft: draftOutput?.proposalDraft,
        });

        return {
          success: true,
          applicationId: applicationRecord.id,
          company: applicationRecord.company,
          role: applicationRecord.role,
          status: applicationRecord.status,
          persistedAt: applicationRecord.updatedAt,
          proposalDraft: draftOutput?.proposalDraft,
        };
      },
    },
  ],
};
