import { z } from 'zod';
import { WorkflowDefinition } from '../types';
import { defaultOpportunityPipeline } from '@/lib/opportunities/pipeline';
import { NormalizedOpportunity, NormalizedOpportunitySchema } from '@/lib/opportunities/types';
import { getProfile } from '@/lib/profile/store';
import { JobDescriptionAnalyzer } from '../analyzer/job-analyzer';
import { ProfileMatcher, ProfileMatchResult } from '../analyzer/profile-matcher';

export const CareerDiscoveryInputSchema = z.object({
  query: z.string().optional().describe('Keyword or focus area'),
  role: z.string().optional().describe('Target role filter'),
  remoteOnly: z.boolean().optional().default(true).describe('Filter for remote work only'),
  maxOpportunities: z.number().optional().default(5).describe('Maximum number of ranked opportunities to return'),
  minimumMatchScore: z.number().optional().default(60).describe('Minimum match score threshold (0-100)'),
});

export type CareerDiscoveryInput = z.infer<typeof CareerDiscoveryInputSchema>;

export const careerDiscoveryWorkflow: WorkflowDefinition = {
  type: 'career_discovery',
  name: 'Career Opportunity Discovery & Research',
  description: 'Discovers live tech opportunities across external sources, validates, deduplicates, matches against Farhan\'s verified profile, ranks deterministically, and researches the top hiring companies.',
  inputSchema: CareerDiscoveryInputSchema,
  steps: [
    {
      id: 'discover',
      name: 'Discover Real Opportunities',
      agent: 'Opportunity Agent',
      tool: 'discover_opportunities',
      execute: async (context) => {
        const input = (context.workflowInput || {}) as CareerDiscoveryInput;
        const rawOpps = await defaultOpportunityPipeline.executePipeline({
          query: input.query,
          role: input.role,
          workModel: input.remoteOnly ? 'remote' : undefined,
          limit: 20,
        });

        return {
          totalFetched: rawOpps.length,
          opportunities: rawOpps,
        };
      },
    },
    {
      id: 'validate_and_normalize',
      name: 'Validate & Normalize Data',
      execute: async (context) => {
        const prevOutput = context.previousSteps[0]?.output as any;
        const rawList: unknown[] = Array.isArray(prevOutput?.opportunities) ? prevOutput.opportunities : [];

        const validated: NormalizedOpportunity[] = [];
        let rejectedCount = 0;

        for (const item of rawList) {
          const parsed = NormalizedOpportunitySchema.safeParse(item);
          if (parsed.success) {
            validated.push(parsed.data);
          } else {
            rejectedCount++;
          }
        }

        return {
          validCount: validated.length,
          rejectedCount,
          validatedOpportunities: validated,
        };
      },
    },
    {
      id: 'deduplicate',
      name: 'Deduplicate Opportunities',
      execute: async (context) => {
        const prevOutput = context.previousSteps[1]?.output as any;
        const list: NormalizedOpportunity[] = prevOutput?.validatedOpportunities || [];

        const seen = new Set<string>();
        const unique: NormalizedOpportunity[] = [];

        for (const opp of list) {
          const key = defaultOpportunityPipeline.getDeduplicationKey(opp);
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(opp);
          }
        }

        return {
          initialCount: list.length,
          uniqueCount: unique.length,
          uniqueOpportunities: unique,
        };
      },
    },
    {
      id: 'match_and_rank',
      name: 'Profile Matching & Deterministic Ranking',
      execute: async (context) => {
        const input = (context.workflowInput || {}) as CareerDiscoveryInput;
        const prevOutput = context.previousSteps[2]?.output as any;
        const opportunities: NormalizedOpportunity[] = prevOutput?.uniqueOpportunities || [];

        const profile = await getProfile();
        const scored = opportunities.map((opp) => {
          const analyzedJd = JobDescriptionAnalyzer.analyze(opp);
          const matchResult = ProfileMatcher.match(analyzedJd, profile);
          return {
            opportunity: opp,
            analyzedJd,
            matchResult,
            score: matchResult.overallMatchScore,
          };
        });

        // Filter by minimum score
        const filtered = scored.filter((item) => item.score >= (input.minimumMatchScore || 60));

        // Deterministic sort by score descending
        filtered.sort((a, b) => b.score - a.score);

        const limit = input.maxOpportunities || 5;
        const topRanked = filtered.slice(0, limit);

        return {
          totalEvaluated: scored.length,
          qualifyingCount: filtered.length,
          topRanked,
          rankedOpportunities: topRanked,
        };
      },
    },
    {
      id: 'research_top_companies',
      name: 'Research Hiring Companies',
      agent: 'Research Agent',
      tool: 'company_research',
      execute: async (context) => {
        const prevOutput = context.previousSteps[3]?.output as any;
        const topRanked: Array<{
          opportunity: NormalizedOpportunity;
          matchResult: ProfileMatchResult;
        }> = prevOutput?.topRanked || [];

        const companyResearches: Array<{
          company: string;
          research: unknown;
          sourceMetadata: any[];
        }> = [];

        // Research top 2 companies to avoid rate-limit exhaustion
        const toResearch = topRanked.slice(0, 2);
        for (const item of toResearch) {
          const companyName = item.opportunity.company;
          try {
            const toolResult = await context.registry.executeTool('company_research', {
              companyName,
              context: `Evaluating role: ${item.opportunity.title} for candidate with verified Next.js, AI, and TypeScript background`,
            });

            const data = toolResult.data as any;
            companyResearches.push({
              company: companyName,
              research: data,
              sourceMetadata: Array.isArray(data?.sources) ? data.sources : [],
            });
          } catch (err) {
            console.warn(`[Workflow: career_discovery] Company research failed for ${companyName}:`, err);
            companyResearches.push({
              company: companyName,
              research: { summary: 'Company research unavailable at this time.' },
              sourceMetadata: [],
            });
          }
        }

        return {
          researchedCount: companyResearches.length,
          companyResearches,
        };
      },
    },
    {
      id: 'synthesize_summary',
      name: 'Synthesize Career Recommendations',
      execute: async (context) => {
        const rankingOutput = context.previousSteps[3]?.output as any;
        const researchOutput = context.previousSteps[4]?.output as any;

        const topRanked = rankingOutput?.topRanked || [];
        const researches = researchOutput?.companyResearches || [];

        const finalRecommendations = topRanked.map((item: any, idx: number) => {
          const companyResearch = researches.find((r: any) => r.company === item.opportunity.company);
          return {
            rank: idx + 1,
            title: item.opportunity.title,
            company: item.opportunity.company,
            location: item.opportunity.location,
            workModel: item.opportunity.workModel,
            salaryRange: item.opportunity.salaryRange || 'Not disclosed',
            url: item.opportunity.url,
            source: item.opportunity.source,
            matchScore: item.score,
            matchedSkills: item.matchResult.matchedSkills,
            missingSkills: item.matchResult.missingSkills,
            factors: item.matchResult.factors,
            companyIntelligence: companyResearch?.research || null,
          };
        });

        const synthesisText = `Discovered and ranked ${finalRecommendations.length} verified career opportunities. Top match: ${finalRecommendations[0]?.title} at ${finalRecommendations[0]?.company} (${finalRecommendations[0]?.matchScore}% score).`;

        return {
          status: 'success',
          recommendationCount: finalRecommendations.length,
          recommendations: finalRecommendations,
          synthesis: synthesisText,
          summary: synthesisText,
        };
      },
    },
  ],
};
