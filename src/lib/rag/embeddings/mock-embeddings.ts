import { EmbeddingProvider } from './types';

export class MockEmbeddingProvider implements EmbeddingProvider {
  public readonly id = 'mock';
  public readonly name = 'Deterministic Mock Embeddings';
  public readonly dimensions = 64;

  /**
   * Generates a deterministic, normalized 64-dimensional float vector based on word frequency and character hashing.
   */
  public async embedQuery(text: string): Promise<number[]> {
    return this.generateVector(text);
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateVector(t));
  }

  private generateVector(text: string): number[] {
    const clean = text.toLowerCase().trim();
    const vec = new Array<number>(this.dimensions).fill(0);

    if (clean.length === 0) {
      vec[0] = 1.0;
      return vec;
    }

    const words = clean.split(/[^a-z0-9_#+.-]+/).filter((w) => w.length > 0);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const hash = this.hashString(word);
      const bucket = Math.abs(hash) % this.dimensions;
      const weight = 1.0 + (word.length > 4 ? 0.5 : 0.0);
      vec[bucket] += weight;

      // Bigram projection
      if (i > 0) {
        const bigram = `${words[i - 1]}_${word}`;
        const biHash = this.hashString(bigram);
        const biBucket = Math.abs(biHash) % this.dimensions;
        vec[biBucket] += 0.75;
      }
    }

    // Normalize to unit length (L2 norm)
    let sumSq = 0;
    for (let i = 0; i < this.dimensions; i++) {
      sumSq += vec[i] * vec[i];
    }

    if (sumSq === 0) {
      vec[0] = 1.0;
      return vec;
    }

    const norm = Math.sqrt(sumSq);
    return vec.map((val) => Number((val / norm).toFixed(6)));
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
