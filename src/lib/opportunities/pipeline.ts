import { db, ensureDatabaseReady } from '@/lib/db';
import { opportunities as opportunitiesTable } from '@/lib/db/schema';
import { getProfile } from '@/lib/profile/store';
import {
  NormalizedOpportunity,
  NormalizedOpportunitySchema,
  MatchedOpportunity,
  OpportunitySource,
  ProfileMatchReasoning,
} from './types';
import { RemotiveOpportunitySource } from './sources/remotive';
import { ArbeitnowOpportunitySource } from './sources/arbeitnow';
import { MockOpportunitySource } from './sources/mock-source';

export interface PipelineOptions {
  query?: string;
  role?: string;
  workModel?: 'remote' | 'hybrid' | 'on-site';
  limit?: number;
  sources?: OpportunitySource[];
  skipExternalFetch?: boolean;
}

export class OpportunityPipeline {
  private sources: OpportunitySource[];

  constructor(customSources?: OpportunitySource[]) {
    if (customSources) {
      this.sources = customSources;
    } else if (process.env.NODE_ENV === 'test') {
      this.sources = [new MockOpportunitySource()];
    } else {
      this.sources = [
        new RemotiveOpportunitySource(),
        new ArbeitnowOpportunitySource(),
      ];
    }
  }

  public setSources(sources: OpportunitySource[]): void {
    this.sources = sources;
  }

  public addSource(source: OpportunitySource): void {
    this.sources.push(source);
  }

  /**
   * Cleans and canonicalizes a URL for deduplication.
   */
  public canonicalizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      // Strip common tracking and referrer params
      parsed.searchParams.delete('ref');
      parsed.searchParams.delete('utm_source');
      parsed.searchParams.delete('utm_medium');
      parsed.searchParams.delete('utm_campaign');
      return parsed.toString().toLowerCase().replace(/\/$/, '');
    } catch {
      return rawUrl.trim().toLowerCase();
    }
  }

  /**
   * Generates a unique deduplication key for an opportunity.
   */
  public getDeduplicationKey(opp: NormalizedOpportunity): string {
    if (opp.source && opp.externalId) {
      return `${opp.source.toLowerCase()}:${opp.externalId.toLowerCase()}`;
    }
    if (opp.url) {
      return `url:${this.canonicalizeUrl(opp.url)}`;
    }
    const normCompany = opp.company.trim().toLowerCase();
    const normTitle = opp.title.trim().toLowerCase();
    const normLoc = opp.location.trim().toLowerCase();
    return `fallback:${normCompany}::${normTitle}::${normLoc}`;
  }

  /**
   * Validates and normalizes raw opportunity objects against schema.
   */
  public validateOpportunity(raw: unknown): NormalizedOpportunity | null {
    const parseResult = NormalizedOpportunitySchema.safeParse(raw);
    if (!parseResult.success) {
      console.warn('[OpportunityPipeline] Opportunity validation failed:', parseResult.error.issues);
      return null;
    }
    return parseResult.data;
  }

  /**
   * Deduplicates an array of opportunities deterministically.
   */
  public deduplicateOpportunities(list: NormalizedOpportunity[]): NormalizedOpportunity[] {
    const seen = new Set<string>();
    const deduplicated: NormalizedOpportunity[] = [];

    for (const opp of list) {
      const key = this.getDeduplicationKey(opp);
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(opp);
      }
    }

    return deduplicated;
  }

  /**
   * Matches an opportunity against Farhan's verified candidate profile.
   */
  public matchOpportunityAgainstProfile(
    opp: NormalizedOpportunity,
    candidateSkills: string[],
    candidateRolePreferences: string[]
  ): MatchedOpportunity {
    const lowerCandidateSkills = candidateSkills.map((s) => s.toLowerCase());
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const req of opp.requiredSkills) {
      const cleanReq = req.trim();
      const lowerReq = cleanReq.toLowerCase();
      const isMatch = lowerCandidateSkills.some((s) => s === lowerReq || s.includes(lowerReq) || lowerReq.includes(s));

      if (isMatch) {
        matchedSkills.push(cleanReq);
      } else {
        missingSkills.push(cleanReq);
      }
    }

    const totalRequired = opp.requiredSkills.length;
    let baseScore = totalRequired > 0 ? Math.round((matchedSkills.length / totalRequired) * 100) : 70;

    // Work model alignment boost
    let workModelFit = true;
    if (opp.workModel === 'remote') {
      baseScore += 5;
    }

    // Role keyword alignment boost
    const lowerTitle = opp.title.toLowerCase();
    const titleMatchesPreference = candidateRolePreferences.some((p) => lowerTitle.includes(p.toLowerCase()));
    if (titleMatchesPreference) {
      baseScore += 5;
    }

    const finalScore = Math.min(Math.max(baseScore, 10), 98); // Nuanced cap: never claims guaranteed fit (100)

    let matchQuality = 'Moderate';
    if (finalScore >= 80) matchQuality = 'Strong';
    else if (finalScore >= 60) matchQuality = 'Good';

    const reasoningSummary = `${matchQuality} match based on available verified profile information. Matched ${matchedSkills.length}/${totalRequired} listed requirements.`;

    const matchDetails: ProfileMatchReasoning = {
      overallScore: finalScore,
      matchedSkills,
      missingSkills,
      qualificationsAssessment: `Verified expertise covers ${matchedSkills.join(', ') || 'foundational software practices'}.`,
      workModelFit,
      summary: reasoningSummary,
    };

    return {
      ...opp,
      matchScore: finalScore,
      matchReason: reasoningSummary,
      matchDetails,
    };
  }

  /**
   * Runs the complete ingestion, deduplication, matching, ranking, and persistence pipeline.
   */
  public async executePipeline(options: PipelineOptions = {}): Promise<MatchedOpportunity[]> {
    await ensureDatabaseReady();
    const profile = await getProfile();

    // Flatten candidate verified skills and role preferences
    const candidateSkills = profile.skills.flatMap((cat) => cat.skills.map((s) => s.name));
    const candidateRoles = profile.careerPreferences.targetRoles || ['AI Systems', 'Software Engineer'];

    let allRawOpportunities: NormalizedOpportunity[] = [];

    // Step 1: Ingest from external/configured sources unless skipped
    if (!options.skipExternalFetch && this.sources.length > 0) {
      let apiSearch: string | undefined = undefined;
      const rawSearch = options.query || options.role;
      if (rawSearch) {
        const parts = rawSearch.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
        apiSearch = parts[0];
      }

      const fetchPromises = this.sources.map((source) =>
        source.fetchOpportunities({ search: apiSearch, limit: options.limit || 15 })
      );
      const results = await Promise.allSettled(fetchPromises);

      for (const res of results) {
        if (res.status === 'fulfilled') {
          allRawOpportunities.push(...res.value);
        }
      }
    }

    // Also load existing opportunities from SQLite to merge
    try {
      const existingDbRecords = await db.select().from(opportunitiesTable);
      for (const row of existingDbRecords) {
        allRawOpportunities.push({
          id: row.id,
          title: row.title,
          company: row.company,
          location: row.location,
          workModel: row.workModel as any,
          salaryRange: row.salaryRange || undefined,
          description: row.description,
          requiredSkills: typeof row.requiredSkills === 'string' ? JSON.parse(row.requiredSkills) : row.requiredSkills,
          url: row.url || `https://${row.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/careers`,
          source: row.source || 'sqlite-store',
          postedAt: row.postedAt,
          retrievedAt: row.retrievedAt || new Date().toISOString(),
          externalId: row.externalId || undefined,
        });
      }
    } catch (err) {
      console.warn('[OpportunityPipeline] Note: Could not read existing SQLite opportunities:', err);
    }

    // Step 2 & 3: Validate with Zod
    const validated = allRawOpportunities.filter((item): item is NormalizedOpportunity => {
      const parsed = this.validateOpportunity(item);
      return parsed !== null;
    });

    // Step 4: Deduplicate
    const deduplicated = this.deduplicateOpportunities(validated);

    // Step 5: Filter by user constraints
    let filtered = deduplicated;
    if (options.workModel) {
      const wmFiltered = filtered.filter((o) => o.workModel === options.workModel);
      if (wmFiltered.length > 0) {
        filtered = wmFiltered;
      }
    }

    if (options.role) {
      const roleTokens = options.role
        .split(/[,;|]|\bor\b/i)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      if (roleTokens.length > 0) {
        const roleFiltered = filtered.filter((o) => {
          const lowerTitle = o.title.toLowerCase();
          const lowerDesc = o.description.toLowerCase();
          return roleTokens.some((token) => lowerTitle.includes(token) || lowerDesc.includes(token));
        });
        if (roleFiltered.length > 0) {
          filtered = roleFiltered;
        }
      }
    }

    if (options.query) {
      const queryTokens = options.query
        .split(/[,;|]|\bor\b/i)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);

      if (queryTokens.length > 0) {
        const queryFiltered = filtered.filter((o) => {
          const lowerTitle = o.title.toLowerCase();
          const lowerCompany = o.company.toLowerCase();
          const lowerSkills = o.requiredSkills.map((s) => s.toLowerCase());
          return queryTokens.some(
            (token) =>
              lowerTitle.includes(token) ||
              lowerCompany.includes(token) ||
              lowerSkills.some((s) => s.includes(token) || token.includes(s))
          );
        });
        if (queryFiltered.length > 0) {
          filtered = queryFiltered;
        }
      }
    }

    if (filtered.length === 0) {
      filtered = deduplicated;
    }

    // Step 6: Match against candidate verified profile
    const matched = filtered.map((opp) =>
      this.matchOpportunityAgainstProfile(opp, candidateSkills, candidateRoles)
    );

    // Step 7: Rank by match score descending
    matched.sort((a, b) => b.matchScore - a.matchScore);

    const finalResults = options.limit ? matched.slice(0, options.limit) : matched;

    // Step 8: Persist discovered opportunities to SQLite
    try {
      for (const opp of finalResults) {
        await db
          .insert(opportunitiesTable)
          .values({
            id: opp.id,
            title: opp.title,
            company: opp.company,
            location: opp.location,
            workModel: opp.workModel,
            salaryRange: opp.salaryRange || null,
            description: opp.description,
            requiredSkills: opp.requiredSkills,
            url: opp.url,
            postedAt: opp.postedAt || new Date().toISOString(),
            source: opp.source,
            retrievedAt: opp.retrievedAt,
            externalId: opp.externalId || null,
          })
          .onConflictDoUpdate({
            target: opportunitiesTable.id,
            set: {
              title: opp.title,
              company: opp.company,
              location: opp.location,
              workModel: opp.workModel,
              salaryRange: opp.salaryRange || null,
              description: opp.description,
              requiredSkills: opp.requiredSkills,
              url: opp.url,
              source: opp.source,
              retrievedAt: opp.retrievedAt,
            },
          });
      }
    } catch (err) {
      console.warn('[OpportunityPipeline] Note: SQLite upsert warning:', err);
    }

    return finalResults;
  }
}

// Global default pipeline instance
export const defaultOpportunityPipeline = new OpportunityPipeline();
