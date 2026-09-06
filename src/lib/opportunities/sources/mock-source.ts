import { OpportunitySource, NormalizedOpportunity } from '../types';

export class MockOpportunitySource implements OpportunitySource {
  public readonly name = 'mock-source';

  private fixtures: NormalizedOpportunity[];

  constructor(customFixtures?: NormalizedOpportunity[]) {
    this.fixtures = customFixtures || [
      {
        id: 'opp-mock-1',
        externalId: 'ext-deepmind-101',
        title: 'Senior AI Systems Engineer',
        company: 'Cognitive Dynamics',
        location: 'Remote (Worldwide)',
        workModel: 'remote',
        description: 'Lead design of multi-agent LLM systems, function calling orchestrators, and production RAG pipelines.',
        requiredSkills: ['TypeScript', 'Python', 'LLM Orchestration', 'PostgreSQL', 'Docker'],
        salaryRange: '$170,000 - $210,000 USD',
        url: 'https://cognitivedynamics.ai/jobs/senior-ai-systems-engineer',
        source: 'mock-source',
        postedAt: '2026-09-08T10:00:00Z',
        retrievedAt: new Date().toISOString(),
      },
      {
        id: 'opp-mock-2',
        externalId: 'ext-hyperion-202',
        title: 'Lead Full-Stack & Agent Architect',
        company: 'Hyperion AI Labs',
        location: 'Remote (Flexible)',
        workModel: 'remote',
        description: 'Build developer-facing agentic platforms, streaming chat interfaces, and resilient SQLite/Postgres backends.',
        requiredSkills: ['TypeScript', 'React', 'Next.js (App Router)', 'Node.js', 'SQL'],
        salaryRange: '$160,000 - $195,000 USD',
        url: 'https://hyperionlabs.dev/careers/lead-architect',
        source: 'mock-source',
        postedAt: '2026-09-09T14:30:00Z',
        retrievedAt: new Date().toISOString(),
      },
      {
        id: 'opp-mock-3',
        externalId: 'ext-embedded-303',
        title: 'Embedded Firmware C++ Engineer',
        company: 'MicroRobotics Corp',
        location: 'On-site (Austin, TX)',
        workModel: 'on-site',
        description: 'Develop low-level micro-controller firmware, RTOS scheduling, and hardware drivers.',
        requiredSkills: ['C++', 'Rust', 'RTOS', 'ARM Cortex', 'Soldering'],
        salaryRange: '$120,000 - $150,000 USD',
        url: 'https://microrobotics.io/jobs/embedded-cpp',
        source: 'mock-source',
        postedAt: '2026-09-07T08:00:00Z',
        retrievedAt: new Date().toISOString(),
      },
    ];
  }

  public setFixtures(fixtures: NormalizedOpportunity[]): void {
    this.fixtures = fixtures;
  }

  public async fetchOpportunities(query: { search?: string; limit?: number } = {}): Promise<NormalizedOpportunity[]> {
    let result = [...this.fixtures];
    if (query.search) {
      const s = query.search.toLowerCase();
      result = result.filter(
        (o) =>
          o.title.toLowerCase().includes(s) ||
          o.company.toLowerCase().includes(s) ||
          o.requiredSkills.some((skill) => skill.toLowerCase().includes(s))
      );
    }
    if (query.limit) {
      result = result.slice(0, query.limit);
    }
    return result;
  }
}
