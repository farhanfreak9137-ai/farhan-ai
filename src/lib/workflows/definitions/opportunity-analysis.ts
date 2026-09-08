import { z } from 'zod';
import { WorkflowDefinition } from '../types';
import { getProfile } from '@/lib/profile/store';
import { JobDescriptionAnalyzer, AnalyzedJobDescription } from '../analyzer/job-analyzer';
import { ProfileMatcher, ProfileMatchResult } from '../analyzer/profile-matcher';

export const OpportunityAnalysisInputSchema = z
  .object({
    companyName: z.string().optional(),
    company: z.string().optional(),
    jobTitle: z.string().optional(),
    roleTitle: z.string().optional(),
    role: z.string().optional(),
    title: z.string().optional(),
    jobDescriptionText: z.string().optional(),
    jobDescription: z.string().optional(),
    description: z.string().optional(),
    text: z.string().optional(),
    url: z.string().url().optional(),
    salaryRange: z.string().optional(),
    location: z.string().optional(),
  })
  .transform((val) => ({
    companyName: val.companyName || val.company || 'Target Company',
    jobTitle: val.jobTitle || val.roleTitle || val.role || val.title || 'Senior Software Engineer',
    jobDescriptionText:
      val.jobDescriptionText || val.jobDescription || val.description || val.text || '',
    url: val.url,
    salaryRange: val.salaryRange,
    location: val.location || 'Remote',
  }));

export type OpportunityAnalysisInput = z.infer<typeof OpportunityAnalysisInputSchema>;

export const opportunityAnalysisWorkflow: WorkflowDefinition = {
  type: 'opportunity_analysis',
  name: 'Deep Opportunity & Strategic Fit Analysis',
  description:
    "Conducts an end-to-end technical evaluation: deconstructs the job description, researches the hiring company and tech stack, matches against Farhan's verified profile, and synthesizes strategic fit.",
  inputSchema: OpportunityAnalysisInputSchema,
  steps: [
    {
      id: 'analyze_jd',
      name: 'Deconstruct Job Description',
      agent: 'Career Agent',
      tool: 'analyze_job_description',
      execute: async (context) => {
        const input = context.workflowInput as OpportunityAnalysisInput;
        const analyzed = JobDescriptionAnalyzer.analyze({
          text: input.jobDescriptionText,
          company: input.companyName,
          title: input.jobTitle,
        });

        return {
          analyzed,
          parsedJD: analyzed,
          requiredSkills: analyzed.requiredSkills,
          technologies: analyzed.technologies,
          constraints: analyzed.constraints,
        };
      },
    },
    {
      id: 'research_company',
      name: 'Research Hiring Company',
      agent: 'Research Agent',
      tool: 'company_research',
      execute: async (context) => {
        const input = context.workflowInput as OpportunityAnalysisInput;
        const toolResult = await context.registry.executeTool('company_research', {
          companyName: input.companyName,
          context: `Target role: ${input.jobTitle}. Focus on technical infrastructure, AI initiatives, engineering reputation.`,
        });

        const data = toolResult.data as any;
        return {
          companyResearch: data || { summary: 'Company overview compiled.' },
          companyName: input.companyName,
          summary: data?.summary || 'Company overview compiled.',
          sources: Array.isArray(data?.sources) ? data.sources : [],
          keyFindings: data?.keyFindings || [],
          verifiedFacts: data?.verifiedFacts || [],
          uncertainties: data?.uncertainties || [],
        };
      },
    },
    {
      id: 'research_technologies',
      name: 'Evaluate Primary Tech Stack',
      agent: 'Research Agent',
      tool: 'technology_research',
      execute: async (context) => {
        const jdOutput = context.previousSteps[0]?.output as any;
        const technologies: string[] = jdOutput?.technologies || [];
        const techNames = technologies.slice(0, 3);

        const techSummary = techNames.length > 0 ? techNames.join(', ') : 'TypeScript, Next.js';
        const toolResult = await context.registry.executeTool('technology_research', {
          topic: techSummary,
          context: 'Evaluate alignment with modern scalable web architectures.',
        });

        const data = toolResult.data as any;
        return {
          techResearch: data || { summary: 'Tech stack evaluation complete.' },
          technologies: techNames,
          summary: data?.summary || 'Tech stack evaluation complete.',
          findings: data?.keyFindings || [],
        };
      },
    },
    {
      id: 'profile_match',
      name: 'Match Against Verified Profile',
      execute: async (context) => {
        const jdOutput = context.previousSteps[0]?.output as any;
        const analyzedJd: AnalyzedJobDescription = jdOutput?.analyzed;

        const profile = await getProfile();
        const matchResult: ProfileMatchResult = ProfileMatcher.match(analyzedJd, profile);

        return {
          matchResult,
          overallScore: matchResult.overallMatchScore,
          matchedSkills: matchResult.matchedSkills,
          missingSkills: matchResult.missingSkills,
          relevantProjects: matchResult.relevantProjects,
          factors: matchResult.factors,
          evidenceClassification: matchResult.evidenceClassification,
          concerns: matchResult.concerns,
        };
      },
    },
    {
      id: 'final_synthesis',
      name: 'Synthesize Opportunity Analysis',
      execute: async (context) => {
        const input = context.workflowInput as OpportunityAnalysisInput;
        const jd = (context.previousSteps[0]?.output as any)?.analyzed;
        const company = context.previousSteps[1]?.output as any;
        const tech = context.previousSteps[2]?.output as any;
        const match = context.previousSteps[3]?.output as any;

        const strategicRecommendation =
          match.overallScore >= 80
            ? 'Strong Recommendation: Pursue actively. Verified capabilities directly overlap with core requirements.'
            : match.overallScore >= 60
            ? 'Moderate Recommendation: Pursue with targeted preparation on adjacent competencies.'
            : 'Cautionary Recommendation: Notable skill or stack gaps detected against verified records.';

        const synthesisText = `Executive Strategic Analysis for ${input.jobTitle} at ${input.companyName} (${match.overallScore}% fit score):\n\n${strategicRecommendation}\n\nCompany Context: ${company.summary}\nTechnology Alignment: ${tech.summary}`;

        return {
          company: input.companyName,
          title: input.jobTitle,
          overallMatchScore: match.overallScore,
          strategicAnalysis: strategicRecommendation,
          strategicRecommendation,
          synthesis: synthesisText,
          companyOverview: company.summary,
          companySources: company.sources,
          techStackInsight: tech.summary,
          matchedStrengths: match.matchedSkills,
          developmentAreas: match.missingSkills,
          relevantPortfolioProjects: match.relevantProjects,
          scoringFactors: match.factors,
          evidenceBoundary: {
            verifiedInProfile: match.evidenceClassification?.verified || [],
            inferredQualities: match.evidenceClassification?.inferred || [],
            unknownInformation: match.evidenceClassification?.unknown || [],
          },
        };
      },
    },
  ],
};
