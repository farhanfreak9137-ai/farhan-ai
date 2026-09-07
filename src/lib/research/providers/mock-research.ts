import { ResearchProvider, ResearchResult, ResearchSearchResponse, ResearchSource } from '../types';

export class MockResearchProvider implements ResearchProvider {
  public readonly id = 'mock-research';
  public readonly name = 'Deterministic Research Engine (Offline/Test)';

  private fixtures: Map<string, ResearchResult> = new Map();
  private searchFixtures: Map<string, ResearchSearchResponse> = new Map();

  constructor() {
    this.seedDefaultFixtures();
  }

  public setFixture(query: string, result: ResearchResult): void {
    this.fixtures.set(query.toLowerCase(), result);
  }

  public setSearchFixture(query: string, result: ResearchSearchResponse): void {
    this.searchFixtures.set(query.toLowerCase(), result);
  }

  public async search(query: string, options: { maxResults?: number } = {}): Promise<ResearchSearchResponse> {
    const key = query.toLowerCase();
    for (const [k, fixture] of this.searchFixtures.entries()) {
      if (key.includes(k)) {
        return {
          ...fixture,
          sources: options.maxResults ? fixture.sources.slice(0, options.maxResults) : fixture.sources,
        };
      }
    }

    const defaultSources: ResearchSource[] = [
      {
        title: `Official Documentation & Findings: ${query}`,
        url: `https://docs.canonical-source.org/${encodeURIComponent(query)}`,
        domain: 'docs.canonical-source.org',
        excerpt: `Verified technical specifications and public disclosures regarding ${query}.`,
        retrievedAt: new Date().toISOString(),
      },
      {
        title: `Industry Analysis on ${query}`,
        url: `https://engineering-insights.net/reports/${encodeURIComponent(query)}`,
        domain: 'engineering-insights.net',
        excerpt: `Architectural analysis and engineering benchmarks for ${query}.`,
        retrievedAt: new Date().toISOString(),
      },
    ];

    return {
      query,
      summary: `Structured factual search results for "${query}". Grounded across ${defaultSources.length} verified technical sources.`,
      sources: options.maxResults ? defaultSources.slice(0, options.maxResults) : defaultSources,
      providerUsed: this.name,
    };
  }

  public async researchCompany(companyName: string, context?: string): Promise<ResearchResult> {
    const key = companyName.toLowerCase();
    for (const [k, fixture] of this.fixtures.entries()) {
      if (key.includes(k)) {
        return fixture;
      }
    }

    const domain = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const sources: ResearchSource[] = [
      {
        title: `${companyName} Engineering & Architecture Portal`,
        url: `https://${domain}/engineering`,
        domain,
        excerpt: `${companyName} is actively building distributed cloud architectures, agentic LLM platforms, and modern web services.`,
        retrievedAt: new Date().toISOString(),
      },
      {
        title: `${companyName} Tech Stack & Open Source Repositories`,
        url: `https://github.com/${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        domain: 'github.com',
        excerpt: `Public repositories utilize TypeScript, Python, Next.js, and containerized microservice architectures.`,
        retrievedAt: new Date().toISOString(),
      },
    ];

    return {
      query: companyName,
      topic: `Company Research: ${companyName}`,
      summary: `Comprehensive evaluation of ${companyName}. Founded as a high-growth technology enterprise with significant investments in AI and cloud systems. Relevant for engineers with background in ${context || 'AI orchestration and full-stack systems'}.`,
      sources,
      keyFindings: [
        `${companyName} maintains major engineering hubs with focus on high-reliability distributed systems.`,
        'Active developer-facing platforms supporting streaming APIs, vector retrieval, and automated pipelines.',
      ],
      verifiedFacts: [
        `Primary web stacks include modern TypeScript and React/Next.js architectures.`,
        `Python and LLM orchestration frameworks deployed for internal and external generative workloads.`,
      ],
      inferences: [
        `Candidate with proven RAG, multi-agent orchestrator, and TypeScript expertise has strong role alignment.`,
      ],
      uncertainties: [
        'Precise unreleased internal project roadmaps are confidential and not publicly verifiable.',
      ],
      providerUsed: this.name,
      retrievedAt: new Date().toISOString(),
    };
  }

  public async researchTechnology(techName: string, context?: string): Promise<ResearchResult> {
    const sources: ResearchSource[] = [
      {
        title: `${techName} Official Technical Specification`,
        url: `https://spec.tech-standard.org/${encodeURIComponent(techName.toLowerCase())}`,
        domain: 'spec.tech-standard.org',
        excerpt: `Core architecture and design patterns for ${techName}.`,
        retrievedAt: new Date().toISOString(),
      },
    ];

    return {
      query: techName,
      topic: `Technology Research: ${techName}`,
      summary: `Technical analysis of ${techName} within modern systems. Evaluated in context of ${context || 'production engineering'}.`,
      sources,
      keyFindings: [`${techName} provides high-throughput abstractions for distributed pipelines.`],
      verifiedFacts: [`Widespread adoption across production enterprise codebases.`],
      inferences: [`Reduces latency and boilerplate in complex stateful workflows.`],
      uncertainties: ['Long-term API stability depends on ongoing active maintenance.'],
      providerUsed: this.name,
      retrievedAt: new Date().toISOString(),
    };
  }

  public async researchMarket(topic: string, context?: string): Promise<ResearchResult> {
    const sources: ResearchSource[] = [
      {
        title: `Tech Talent Benchmark: ${topic}`,
        url: `https://market-insights.tech/benchmarks/${encodeURIComponent(topic.toLowerCase())}`,
        domain: 'market-insights.tech',
        excerpt: `Verified market salary ranges, hiring momentum, and remote availability for ${topic}.`,
        retrievedAt: new Date().toISOString(),
      },
    ];

    return {
      query: topic,
      topic: `Market Research: ${topic}`,
      summary: `Market assessment for ${topic} in tech careers (${context || 'Senior Engineering'}).`,
      sources,
      keyFindings: [`High demand for specialized practitioners combining AI orchestration with production web expertise.`],
      verifiedFacts: [`Senior US/Remote roles typically offer $140k - $210k+ USD base compensation.`],
      inferences: [`Candidates with demonstrated persistent agent architecture command premium compensation.`],
      uncertainties: ['Compensation figures vary by geographical location and equity vesting structures.'],
      providerUsed: this.name,
      retrievedAt: new Date().toISOString(),
    };
  }

  private seedDefaultFixtures(): void {
    // Specific fixture for Microsoft to support exact test assertions
    const msSources: ResearchSource[] = [
      {
        title: 'Microsoft Official AI Platform & Copilot Infrastructure',
        url: 'https://microsoft.com/ai',
        domain: 'microsoft.com',
        excerpt: 'Microsoft leads enterprise AI platforms, Azure OpenAI Service, and Copilot integrations across developer tools.',
        retrievedAt: new Date().toISOString(),
      },
      {
        title: 'Microsoft Developer Careers & Engineering Stacks',
        url: 'https://careers.microsoft.com',
        domain: 'careers.microsoft.com',
        excerpt: 'Engineering roles actively prioritize TypeScript, Python, Azure cloud infrastructure, and large-scale agent systems.',
        retrievedAt: new Date().toISOString(),
      },
    ];

    this.fixtures.set('microsoft', {
      query: 'Microsoft',
      topic: 'Company Research: Microsoft',
      summary: 'Microsoft Corporation is a global technology leader headquartered in Redmond, Washington. Key focus areas include Azure cloud, generative AI Copilots, and enterprise developer tools.',
      sources: msSources,
      keyFindings: [
        'Massive enterprise investment in Azure OpenAI, Copilot ecosystem, and AI infrastructure.',
        'High developer ecosystem presence across GitHub, TypeScript, and VS Code.',
      ],
      verifiedFacts: [
        'Headquartered in Redmond, Washington with global engineering operations.',
        'Core languages in production include TypeScript, C#, Python, and C++.',
      ],
      inferences: [
        'Farhan’s strong TypeScript, React/Next.js, and LLM orchestration profile matches Azure/Copilot developer engineering teams.',
      ],
      uncertainties: [
        'Exact team-specific compensation packages and headcount quotas are not publicly disclosed.',
      ],
      providerUsed: this.name,
      retrievedAt: new Date().toISOString(),
    });
  }
}
