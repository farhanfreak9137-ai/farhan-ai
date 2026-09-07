import { z } from 'zod';
import { Agent } from './types';
import { resolveResearchProvider } from '../research/factory';

export const ResearchAgent: Agent = {
  id: 'research_agent',
  name: 'Research Agent',
  description: 'Specialized agent for live web research, company intelligence, tech stack evaluation, and market benchmarking using grounded external citations.',
  capabilities: [
    'market_intelligence',
    'company_research',
    'technology_research',
    'web_search',
    'salary_benchmarks',
  ],
  tools: [
    {
      name: 'web_search',
      description: 'Search the live web for factual information, recent technical news, or documentation with verified source citations and URLs.',
      agentId: 'research_agent',
      inputSchema: z.object({
        query: z.string().min(1).describe('The web search query to look up on the live internet'),
        maxResults: z.number().min(1).max(10).optional().default(5).describe('Maximum sources to return (1-10)'),
      }),
      execute: async (input) => {
        try {
          const provider = resolveResearchProvider();
          const result = await provider.search(input.query, { maxResults: input.maxResults });
          return {
            toolName: 'web_search',
            success: true,
            data: result,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Web search failed';
          return {
            toolName: 'web_search',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'company_research',
      description: 'Conduct deep, structured candidate-focused research on a target company including overview, engineering stack, recent AI initiatives, candidate fit, and source links.',
      agentId: 'research_agent',
      inputSchema: z.object({
        companyName: z.string().min(1).describe('The target company name to research (e.g. "Microsoft", "Anthropic", "DeepMind")'),
        context: z.string().optional().describe('Candidate engineering focus or target roles'),
      }),
      execute: async (input) => {
        try {
          const provider = resolveResearchProvider();
          const result = await provider.researchCompany(input.companyName, input.context);
          return {
            toolName: 'company_research',
            success: true,
            data: result,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Company research failed';
          return {
            toolName: 'company_research',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'technology_research',
      description: 'Research an emerging technology, library, framework, or architecture pattern with real production use cases and source citations.',
      agentId: 'research_agent',
      inputSchema: z.object({
        technology: z.string().min(1).describe('The technology or framework to evaluate (e.g. "Drizzle ORM", "Next.js Turbopack", "LangGraph")'),
        context: z.string().optional().describe('Specific production or career context to evaluate'),
      }),
      execute: async (input) => {
        try {
          const provider = resolveResearchProvider();
          const result = await provider.researchTechnology(input.technology, input.context);
          return {
            toolName: 'technology_research',
            success: true,
            data: result,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Technology research failed';
          return {
            toolName: 'technology_research',
            success: false,
            error: msg,
          };
        }
      },
    },
    {
      name: 'market_research',
      description: 'Research tech hiring demand, compensation ranges, and industry trends for specific roles or technical domains with grounded evidence.',
      agentId: 'research_agent',
      inputSchema: z.object({
        topic: z.string().min(1).describe('Target role, technology, or market segment (e.g. "Staff AI Systems Engineer", "Next.js remote compensation")'),
        context: z.string().optional().describe('Geographic or seniority context'),
      }),
      execute: async (input) => {
        try {
          const provider = resolveResearchProvider();
          const result = await provider.researchMarket(input.topic, input.context);
          return {
            toolName: 'market_research',
            success: true,
            data: result,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Market research failed';
          return {
            toolName: 'market_research',
            success: false,
            error: msg,
          };
        }
      },
    },
  ],
};

export const researchAgent = ResearchAgent;
