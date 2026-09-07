export interface ResearchSource {
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  retrievedAt: string;
}

export interface ResearchResult {
  query: string;
  topic: string;
  summary: string;
  sources: ResearchSource[];
  keyFindings: string[];
  verifiedFacts: string[];
  inferences: string[];
  uncertainties: string[];
  missingInformation?: string;
  providerUsed: string;
  retrievedAt: string;
}

export interface ResearchSearchResponse {
  query: string;
  sources: ResearchSource[];
  summary?: string;
  providerUsed: string;
}

export interface ResearchProvider {
  readonly id: string;
  readonly name: string;
  search(query: string, options?: { maxResults?: number }): Promise<ResearchSearchResponse>;
  researchCompany(companyName: string, context?: string): Promise<ResearchResult>;
  researchTechnology(techName: string, context?: string): Promise<ResearchResult>;
  researchMarket(topic: string, context?: string): Promise<ResearchResult>;
}
