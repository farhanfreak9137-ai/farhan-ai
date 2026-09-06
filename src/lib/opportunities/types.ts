import { z } from 'zod';

export const NormalizedOpportunitySchema = z.object({
  id: z.string().min(1),
  externalId: z.string().optional(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  workModel: z.enum(['remote', 'hybrid', 'on-site']),
  description: z.string().min(1),
  requiredSkills: z.array(z.string()),
  salaryRange: z.string().optional(),
  url: z.string().url(),
  source: z.string().min(1),
  postedAt: z.string().optional(),
  retrievedAt: z.string(),
});

export type NormalizedOpportunity = z.infer<typeof NormalizedOpportunitySchema>;

export interface ProfileMatchReasoning {
  overallScore: number; // 0-100
  matchedSkills: string[];
  missingSkills: string[];
  qualificationsAssessment: string;
  workModelFit: boolean;
  summary: string;
}

export interface MatchedOpportunity extends NormalizedOpportunity {
  matchScore: number; // 0-100
  matchReason: string;
  matchDetails: ProfileMatchReasoning;
}

export interface OpportunitySource {
  readonly name: string;
  fetchOpportunities(query?: { search?: string; limit?: number }): Promise<NormalizedOpportunity[]>;
}
