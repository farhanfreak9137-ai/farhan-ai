export interface EmbeddingProvider {
  readonly id: string;
  readonly name: string;
  readonly dimensions: number;
  embedQuery(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
