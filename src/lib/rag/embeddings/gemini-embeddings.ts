import { GoogleGenAI } from '@google/genai';
import { EmbeddingProvider } from './types';
import { MockEmbeddingProvider } from './mock-embeddings';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini Embeddings';
  public readonly dimensions = 768;

  private client: GoogleGenAI;
  private model: string;
  private fallbackProvider: MockEmbeddingProvider;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured for GeminiEmbeddingProvider');
    }
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = model || process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
    this.fallbackProvider = new MockEmbeddingProvider();
  }

  public async embedQuery(text: string): Promise<number[]> {
    try {
      const response: any = await this.client.models.embedContent({
        model: this.model,
        contents: text,
      });

      const values = response?.embedding?.values || response?.values;
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
      throw new Error('No embedding values returned from Gemini API');
    } catch (err: unknown) {
      console.warn(
        `[GeminiEmbeddingProvider] API embed failed with model '${this.model}', falling back to deterministic embedding:`,
        (err as any)?.message || err
      );
      return this.fallbackProvider.embedQuery(text);
    }
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const vec = await this.embedQuery(text);
      results.push(vec);
    }
    return results;
  }
}
