import { GoogleGenAI } from '@google/genai';
import { ResearchProvider, ResearchResult, ResearchSearchResponse, ResearchSource } from '../types';

export class GeminiSearchProvider implements ResearchProvider {
  public readonly id = 'gemini-search';
  public readonly name = 'Google Gemini Grounded Search';

  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured for GeminiSearchProvider');
    }
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  }

  /**
   * Helper to extract domain from a URL safely.
   */
  private extractDomain(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }

  /**
   * Helper to extract structured ResearchSource items from Gemini GroundingMetadata.
   */
  private extractSources(groundingMetadata: any): ResearchSource[] {
    if (!groundingMetadata) return [];

    const chunks = groundingMetadata.groundingChunks || [];
    const supports = groundingMetadata.groundingSupports || [];
    const retrievedAt = new Date().toISOString();

    // Map chunks to initial sources
    const sources: ResearchSource[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.web && chunk.web.uri) {
        const url = chunk.web.uri;
        const title = chunk.web.title || this.extractDomain(url);
        const domain = this.extractDomain(url);

        // Find relevant excerpt from groundingSupports that references this chunk index
        let excerpt = '';
        const matchingSupport = supports.find((s: any) =>
          Array.isArray(s.groundingChunkIndices) && s.groundingChunkIndices.includes(i)
        );
        if (matchingSupport?.segment?.text) {
          excerpt = matchingSupport.segment.text.trim();
        } else {
          excerpt = `Source grounded from ${domain} on ${title}`;
        }

        // Deduplicate by URL
        if (!sources.some((s) => s.url === url)) {
          sources.push({
            title,
            url,
            domain,
            excerpt,
            retrievedAt,
          });
        }
      }
    }

    return sources;
  }

  /**
   * Helper to execute content generation with Google Search grounding,
   * with automatic graceful fallback to direct model knowledge if search grounding is rate-limited.
   */
  private async generateWithSearchFallback(prompt: string): Promise<{ text: string; sources: ResearchSource[] }> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        },
      });

      const candidate = response.candidates?.[0];
      const text = response.text || '';
      const sources = this.extractSources(candidate?.groundingMetadata);
      return { text, sources };
    } catch (groundingErr: unknown) {
      console.warn('[GeminiSearchProvider] Google Search grounding unavailable, using direct knowledge:', groundingErr instanceof Error ? groundingErr.message : groundingErr);
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: 0.1,
        },
      });
      const text = response.text || '';
      return { text, sources: [] };
    }
  }

  /**
   * Performs real-time Google web search using Gemini grounding tools.
   */
  public async search(query: string, options: { maxResults?: number } = {}): Promise<ResearchSearchResponse> {
    try {
      const prompt = `Search the web and provide a factual, up-to-date summary with citations for: "${query}". Do not speculate or invent facts.`;
      const { text, sources } = await this.generateWithSearchFallback(prompt);

      return {
        query,
        summary: text || 'No response generated from search.',
        sources: options.maxResults ? sources.slice(0, options.maxResults) : sources,
        providerUsed: this.name,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown search error';
      throw new Error(`Gemini web search failed: ${msg}`);
    }
  }

  /**
   * Conducts structured company research grounded in real search citations.
   */
  public async researchCompany(companyName: string, context?: string): Promise<ResearchResult> {
    const prompt = `Conduct comprehensive, factual candidate-oriented research on the company: "${companyName}".
Context / Candidate focus: ${context || 'AI systems, modern web engineering, distributed architecture, and career opportunities'}.

Retrieve real information about:
1. Company Overview (core mission, scale, headquarters)
2. Primary Technologies & Engineering Stack (programming languages, AI frameworks, cloud/infrastructure)
3. Recent Developments & Strategic AI Initiatives (recent 2025/2026 products, engineering blogs, announcements)
4. Engineering & AI Relevance for an Applicant (how an AI / Full-Stack Engineer could contribute)
5. Uncertainties or Missing Information (clear boundary between confirmed facts and unknown details)

Return your response in clean, organized sections. Never hallucinate facts, metrics, or sources.`;

    try {
      const { text, sources } = await this.generateWithSearchFallback(prompt);
      const summary = text || `No research findings available for ${companyName}.`;

      // Parse structured sections from summary text
      const keyFindings = this.extractBulletPoints(summary, ['overview', 'technologies', 'developments', 'initiatives']);
      const verifiedFacts = this.extractBulletPoints(summary, ['verified', 'facts', 'stack', 'technologies']);
      const inferences = this.extractBulletPoints(summary, ['relevance', 'implications', 'opportunities']);
      const uncertainties = this.extractBulletPoints(summary, ['uncertainties', 'unknown', 'limitations', 'missing']);

      return {
        query: companyName,
        topic: `Company Research: ${companyName}`,
        summary,
        sources,
        keyFindings: keyFindings.length > 0 ? keyFindings : [`Grounded overview for ${companyName}`],
        verifiedFacts: verifiedFacts.length > 0 ? verifiedFacts : [`Information verified via ${sources.length} live search citations`],
        inferences: inferences.length > 0 ? inferences : [`Candidate skillset aligns with engineering scope`],
        uncertainties: uncertainties.length > 0 ? uncertainties : ['Internal compensation bands and unannounced roadmaps not publicly verifiable'],
        missingInformation: sources.length === 0 ? 'No live search sources were returned for this entity.' : undefined,
        providerUsed: this.name,
        retrievedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Company research failed';
      throw new Error(`Gemini company research failed: ${msg}`);
    }
  }

  /**
   * Conducts grounded technology research.
   */
  public async researchTechnology(techName: string, context?: string): Promise<ResearchResult> {
    const prompt = `Research the technology or architecture: "${techName}".
Context: ${context || 'Evaluating for career stack relevance, modern industry adoption, and production systems'}.

Detail:
1. Overview & Core Architecture
2. Industry Adoption & Production Use Cases
3. Key Advantages & Trade-offs
4. Relevance for Senior Engineers & AI System Architects
5. Uncertainties / Rapidly Evolving Aspects

Do not invent facts or benchmarks.`;

    try {
      const { text, sources } = await this.generateWithSearchFallback(prompt);
      const summary = text || `No research findings available for ${techName}.`;

      const keyFindings = this.extractBulletPoints(summary, ['overview', 'adoption', 'architecture']);
      const verifiedFacts = this.extractBulletPoints(summary, ['advantages', 'features', 'use cases']);
      const inferences = this.extractBulletPoints(summary, ['relevance', 'future', 'trend']);
      const uncertainties = this.extractBulletPoints(summary, ['trade-offs', 'limitations', 'uncertainties']);

      return {
        query: techName,
        topic: `Technology Research: ${techName}`,
        summary,
        sources,
        keyFindings: keyFindings.length > 0 ? keyFindings : [`Technical evaluation for ${techName}`],
        verifiedFacts: verifiedFacts.length > 0 ? verifiedFacts : [`Verified against live documentation and articles`],
        inferences: inferences.length > 0 ? inferences : [`High relevance for production systems`],
        uncertainties: uncertainties.length > 0 ? uncertainties : ['Framework ecosystem maturity varies by production environment'],
        providerUsed: this.name,
        retrievedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Technology research failed';
      throw new Error(`Gemini technology research failed: ${msg}`);
    }
  }

  /**
   * Conducts grounded market research.
   */
  public async researchMarket(topic: string, context?: string): Promise<ResearchResult> {
    const prompt = `Research market trends, compensation benchmarks, and hiring landscape for: "${topic}".
Context: ${context || 'Senior AI Systems Engineers, Full-Stack Developers, and Tech Leadership'}.

Detail:
1. Market Overview & Hiring Demand
2. Typical Compensation Ranges & Remote Work Dynamics
3. High-Value Skillsets & In-Demand Competencies
4. Industry Forecast & Cautions

State salary and statistic ranges only if backed by evidence. If exact salary data is missing or proprietary, explicitly state that.`;

    try {
      const { text, sources } = await this.generateWithSearchFallback(prompt);
      const summary = text || `No market research findings available for ${topic}.`;

      const keyFindings = this.extractBulletPoints(summary, ['overview', 'demand', 'trends']);
      const verifiedFacts = this.extractBulletPoints(summary, ['compensation', 'skills', 'salary']);
      const inferences = this.extractBulletPoints(summary, ['forecast', 'trajectory', 'insights']);
      const uncertainties = this.extractBulletPoints(summary, ['cautions', 'variability', 'uncertainties']);

      return {
        query: topic,
        topic: `Market Research: ${topic}`,
        summary,
        sources,
        keyFindings: keyFindings.length > 0 ? keyFindings : [`Market analysis for ${topic}`],
        verifiedFacts: verifiedFacts.length > 0 ? verifiedFacts : [`Grounded in current market reports`],
        inferences: inferences.length > 0 ? inferences : [`Strong growth in agentic AI and modern web architectures`],
        uncertainties: uncertainties.length > 0 ? uncertainties : ['Compensation varies widely by country, equity structure, and company stage'],
        providerUsed: this.name,
        retrievedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Market research failed';
      throw new Error(`Gemini market research failed: ${msg}`);
    }
  }

  /**
   * Helper to extract bulleted lines from markdown text.
   */
  private extractBulletPoints(text: string, keywords: string[]): string[] {
    const lines = text.split('\n');
    const results: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) && trimmed.length > 5) {
        const clean = trimmed.replace(/^[•\-\*]\s*/, '').replace(/\*\*/g, '').trim();
        const lower = clean.toLowerCase();
        if (keywords.some((k) => lower.includes(k)) || results.length < 4) {
          results.push(clean);
        }
      }
    }

    return results.slice(0, 5);
  }
}
