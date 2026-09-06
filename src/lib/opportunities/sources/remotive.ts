import { OpportunitySource, NormalizedOpportunity } from '../types';

export class RemotiveOpportunitySource implements OpportunitySource {
  public readonly name = 'remotive';

  public async fetchOpportunities(query: { search?: string; limit?: number } = {}): Promise<NormalizedOpportunity[]> {
    const limit = query.limit || 20;
    let cleanSearch = query.search?.trim();
    if (cleanSearch && (cleanSearch.includes(',') || cleanSearch.includes(';') || cleanSearch.length > 40)) {
      cleanSearch = cleanSearch.split(/[,;|]/)[0].trim();
    }
    const searchParam = cleanSearch ? `&search=${encodeURIComponent(cleanSearch)}` : '';
    let url = `https://remotive.com/api/remote-jobs?category=software-dev${searchParam}&limit=${limit}`;

    try {
      let response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FarhanAI-CareerAgent/1.0',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`Remotive API responded with status ${response.status}`);
      }

      let data = await response.json();
      let rawJobs = Array.isArray(data.jobs) ? data.jobs : [];

      // If search parameter returned 0 results, fall back to general software category
      if (rawJobs.length === 0 && searchParam) {
        const fallbackUrl = `https://remotive.com/api/remote-jobs?category=software-dev&limit=${limit}`;
        const fbRes = await fetch(fallbackUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'FarhanAI-CareerAgent/1.0',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          rawJobs = Array.isArray(fbData.jobs) ? fbData.jobs : [];
        }
      }

      const retrievedAt = new Date().toISOString();

      return rawJobs.map((job: any): NormalizedOpportunity => {
        // Strip HTML tags from description
        const rawDesc = String(job.description || '');
        const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

        // Extract skills/tags
        const tags: string[] = Array.isArray(job.tags) ? job.tags : [];

        return {
          id: `opp-remotive-${job.id}`,
          externalId: String(job.id),
          title: String(job.title || 'Software Engineer'),
          company: String(job.company_name || 'Tech Company'),
          location: String(job.candidate_required_location || 'Remote (Worldwide)'),
          workModel: 'remote',
          description: cleanDesc.slice(0, 800) || 'Full-stack / AI remote software opportunity.',
          requiredSkills: tags.length > 0 ? tags : ['Software Engineering', 'Remote Collaboration'],
          salaryRange: job.salary ? String(job.salary) : undefined,
          url: String(job.url),
          source: 'remotive',
          postedAt: job.publication_date ? String(job.publication_date) : undefined,
          retrievedAt,
        };
      });
    } catch (err: unknown) {
      console.warn('[RemotiveSource] Failed to fetch live opportunities:', err instanceof Error ? err.message : err);
      return [];
    }
  }
}
