import { OpportunitySource, NormalizedOpportunity } from '../types';

export class ArbeitnowOpportunitySource implements OpportunitySource {
  public readonly name = 'arbeitnow';

  public async fetchOpportunities(query: { search?: string; limit?: number } = {}): Promise<NormalizedOpportunity[]> {
    const limit = query.limit || 20;
    let cleanSearch = query.search?.trim();
    if (cleanSearch && (cleanSearch.includes(',') || cleanSearch.includes(';') || cleanSearch.length > 40)) {
      cleanSearch = cleanSearch.split(/[,;|]/)[0].trim();
    }
    const searchParam = cleanSearch ? `?search=${encodeURIComponent(cleanSearch)}` : '';
    let url = `https://www.arbeitnow.com/api/job-board-api${searchParam}`;

    try {
      let response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FarhanAI-CareerAgent/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Arbeitnow API responded with status ${response.status}`);
      }

      let data = await response.json();
      let rawJobs = Array.isArray(data.data) ? data.data.slice(0, limit) : [];

      // If search parameter returned 0 results, fall back to general job board
      if (rawJobs.length === 0 && searchParam) {
        const fallbackUrl = `https://www.arbeitnow.com/api/job-board-api`;
        const fbRes = await fetch(fallbackUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FarhanAI-CareerAgent/1.0',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          rawJobs = Array.isArray(fbData.data) ? fbData.data.slice(0, limit) : [];
        }
      }

      const retrievedAt = new Date().toISOString();

      return rawJobs.map((job: any): NormalizedOpportunity => {
        const rawDesc = String(job.description || '');
        const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
        const tags: string[] = Array.isArray(job.tags) ? job.tags : [];
        const isRemote = Boolean(job.remote);

        return {
          id: `opp-arbeitnow-${job.slug || Math.random().toString(36).substring(2, 8)}`,
          externalId: String(job.slug || ''),
          title: String(job.title || 'Software Developer'),
          company: String(job.company_name || 'Hiring Enterprise'),
          location: String(job.location || (isRemote ? 'Remote' : 'Hybrid')),
          workModel: isRemote ? 'remote' : 'hybrid',
          description: cleanDesc.slice(0, 800) || 'Engineering opportunity at technology company.',
          requiredSkills: tags.length > 0 ? tags : ['Software Development', 'System Architecture'],
          url: String(job.url),
          source: 'arbeitnow',
          postedAt: job.created_at ? new Date(job.created_at * 1000).toISOString() : undefined,
          retrievedAt,
        };
      });
    } catch (err: unknown) {
      console.warn('[ArbeitnowSource] Failed to fetch live opportunities:', err instanceof Error ? err.message : err);
      return [];
    }
  }
}
