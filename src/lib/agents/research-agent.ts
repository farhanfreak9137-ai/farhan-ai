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
    {
      name: 'generate_drawing_suggestions',
      description: 'Provides structured artistic guidance, composition concepts, harmonious color palettes (with hex codes), pose/anatomy breakdowns, and step-by-step sketching milestones when you want to draw something.',
      agentId: 'research_agent',
      inputSchema: z.object({
        theme: z.string().describe('Subject or concept to draw (e.g. "Cyberpunk Dhaka street", "Fantasy knight", "Anime portrait", "Lofi study room")'),
        medium: z.enum(['digital', 'pencil', 'ink', 'watercolor', 'anime', 'oil']).optional().default('digital').describe('Art medium or style preference'),
        experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate').describe('Artist skill level'),
      }),
      execute: async (input) => {
        const theme = input.theme.trim();
        const medium = input.medium || 'digital';
        const level = input.experienceLevel || 'intermediate';

        const palettes: Record<string, { primary: string; secondary: string; accent: string; background: string; mood: string }> = {
          cyberpunk: { primary: '#00F0FF', secondary: '#FF003C', accent: '#FFE600', background: '#0D0221', mood: 'High contrast neon and atmospheric grime' },
          fantasy: { primary: '#D4AF37', secondary: '#2E5A88', accent: '#C41E3A', background: '#1A181B', mood: 'Regal, mythical, deep earth and metallic glow' },
          nature: { primary: '#2D6A4F', secondary: '#52B788', accent: '#D8F3DC', background: '#081C15', mood: 'Organic, tranquil, soft dappled light' },
          lofi: { primary: '#F4A261', secondary: '#E76F51', accent: '#2A9D8F', background: '#264653', mood: 'Warm nostalgic dusk, amber interior lighting' },
          monochrome: { primary: '#FFFFFF', secondary: '#8A8A8A', accent: '#000000', background: '#1A1A1A', mood: 'Dramatic chiaroscuro and stark ink silhouettes' },
        };

        const matchedKey = Object.keys(palettes).find((k) => theme.toLowerCase().includes(k)) || 'cyberpunk';
        const palette = palettes[matchedKey] || palettes.cyberpunk;

        return {
          toolName: 'generate_drawing_suggestions',
          success: true,
          data: {
            theme,
            medium,
            experienceLevel: level,
            composition: {
              focalPoint: `Main subject placed along the upper or lower third intersection.`,
              ruleOfThirds: `Offset the horizon line and guide viewer eye using leading diagonal perspective lines.`,
              lighting: `Single key light source coming from top-left (45°) with subtle rim-light highlights.`,
            },
            colorPalette: palette,
            stepByStepRoadmap: [
              '1. Thumbnailing & Gestures: Draw 3-4 tiny 1-minute box sketches exploring camera angles (worms-eye vs eye-level).',
              '2. Construction & Basic Geometry: Block out simple 3D primitives (cylinders, cubes, spheres) to lock perspective.',
              '3. Anatomy & Secondary Shapes: Carve in silhouette edges, character poses, folds, and overlapping forms.',
              '4. Lineart & Value Blocking: Clean up linework with varied line weight (thicker lines on underside and occlusion zones).',
              '5. Ambient Occlusion & Color: Lay in flat base colors using the suggested palette, then paint cast shadows and key light reflections.',
            ],
            referencePrompt: `cinematic concept art of ${theme}, ${medium} style, dramatic lighting, detailed composition, 8k resolution`,
          },
        };
      },
    },
  ],
};

export const researchAgent = ResearchAgent;
