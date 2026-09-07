import { ResearchProvider } from './types';
import { GeminiSearchProvider } from './providers/gemini-search';
import { MockResearchProvider } from './providers/mock-research';

let customProviderInstance: ResearchProvider | null = null;

/**
 * Allows tests to inject a specific provider instance.
 */
export function setResearchProvider(provider: ResearchProvider | null): void {
  customProviderInstance = provider;
}

/**
 * Resolves the appropriate research provider:
 * 1. Test-injected custom provider if present
 * 2. GeminiSearchProvider if GEMINI_API_KEY is configured
 * 3. MockResearchProvider as graceful offline/testing fallback
 */
export function resolveResearchProvider(): ResearchProvider {
  if (customProviderInstance) {
    return customProviderInstance;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim() !== '' && process.env.NODE_ENV !== 'test') {
    try {
      return new GeminiSearchProvider(geminiKey);
    } catch (err) {
      console.warn('[ResearchFactory] Failed to initialize GeminiSearchProvider, falling back to mock:', err);
    }
  }

  return new MockResearchProvider();
}
