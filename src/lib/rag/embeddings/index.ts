import { EmbeddingProvider } from './types';
import { GeminiEmbeddingProvider } from './gemini-embeddings';
import { MockEmbeddingProvider } from './mock-embeddings';

export * from './types';
export * from './mock-embeddings';
export * from './gemini-embeddings';

let customProvider: EmbeddingProvider | null = null;

export function setCustomEmbeddingProvider(provider: EmbeddingProvider | null): void {
  customProvider = provider;
}

export function resolveEmbeddingProvider(preference?: string): EmbeddingProvider {
  if (customProvider) {
    return customProvider;
  }

  if (preference === 'mock') {
    return new MockEmbeddingProvider();
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim() !== '') {
    try {
      return new GeminiEmbeddingProvider(geminiKey);
    } catch {
      // Fallback to deterministic mock
    }
  }

  return new MockEmbeddingProvider();
}
