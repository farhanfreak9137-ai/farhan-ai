import { DocumentChunk, RetrievalResult } from './types';
import { db, ensureDatabaseReady } from '@/lib/db';
import { documentChunks as documentChunksTable, documents as documentsTable } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { EmbeddingProvider } from './embeddings/types';
import { resolveEmbeddingProvider } from './embeddings';

export interface SearchOptions {
  topK?: number;
  minSimilarity?: number;
  documentFilter?: string;
  sourceFilter?: string;
}

export class VectorIndex {
  private chunksMap: Map<string, DocumentChunk> = new Map();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private embeddingProvider?: EmbeddingProvider;

  constructor(provider?: EmbeddingProvider) {
    this.embeddingProvider = provider;
  }

  private getProvider(): EmbeddingProvider {
    return this.embeddingProvider || resolveEmbeddingProvider();
  }

  /**
   * Initializes the vector index cache from canonical SQLite database.
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          await ensureDatabaseReady();
          const rows = await db.select().from(documentChunksTable).orderBy(desc(documentChunksTable.createdAt));
          this.chunksMap.clear();

          for (const row of rows) {
            let embedding: number[] = [];
            if (row.embedding) {
              embedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
            }

            this.chunksMap.set(row.id, {
              id: row.id,
              documentId: row.documentId,
              chunkIndex: row.chunkIndex,
              content: row.content,
              page: row.page,
              source: row.source,
              tokenEstimate: row.tokenEstimate,
              embedding,
              metadata: (row.metadata as any) || {},
              createdAt: row.createdAt,
            });
          }
        } catch (err) {
          console.error('[VectorIndex] Error loading chunks from SQLite:', err);
        } finally {
          this.isInitialized = true;
        }
      })();
    }
    return this.initPromise;
  }

  /**
   * Cosine similarity between two numerical vectors.
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Adds or updates a chunk in the in-memory vector index.
   */
  public indexChunk(chunk: DocumentChunk): void {
    this.chunksMap.set(chunk.id, chunk);
  }

  /**
   * Convenience method to insert a chunk and mark the in-memory index initialized.
   */
  public addChunk(chunk: DocumentChunk): void {
    this.isInitialized = true;
    this.chunksMap.set(chunk.id, chunk);
  }

  /**
   * Removes all chunks belonging to a document from the index.
   */
  public removeDocument(documentId: string): void {
    for (const [id, chunk] of this.chunksMap.entries()) {
      if (chunk.documentId === documentId) {
        this.chunksMap.delete(id);
      }
    }
  }

  /**
   * Semantic vector search retrieving the top-K most relevant chunks.
   */
  public async search(query: string, options: SearchOptions = {}): Promise<RetrievalResult[]> {
    await this.ensureInitialized();

    const topK = options.topK || 5;
    const minSimilarity = options.minSimilarity !== undefined ? options.minSimilarity : 0.2;
    const provider = this.getProvider();

    // Generate query embedding vector
    const queryVector = await provider.embedQuery(query);
    const retrievedAt = new Date().toISOString();

    const scoredResults: RetrievalResult[] = [];

    // Retrieve document title lookup
    for (const chunk of this.chunksMap.values()) {
      // Filter by document ID if specified
      if (options.documentFilter && chunk.documentId !== options.documentFilter) {
        continue;
      }

      // Filter by source if specified
      if (options.sourceFilter && chunk.source !== options.sourceFilter) {
        continue;
      }

      const chunkVector = chunk.embedding;
      if (!chunkVector || chunkVector.length === 0) {
        continue;
      }

      // Fallback alignment if embedding dimensions differ between providers
      let similarity = 0;
      if (chunkVector.length === queryVector.length) {
        similarity = VectorIndex.cosineSimilarity(queryVector, chunkVector);
      } else {
        // Truncate or pad to common dimension for graceful cross-provider fallback
        const minDim = Math.min(queryVector.length, chunkVector.length);
        similarity = VectorIndex.cosineSimilarity(queryVector.slice(0, minDim), chunkVector.slice(0, minDim));
      }

      if (similarity >= minSimilarity) {
        scoredResults.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: (chunk.metadata?.documentTitle as string) || (chunk.metadata?.filename as string) || chunk.documentId,
          source: chunk.source,
          page: chunk.page,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          similarity: Number(similarity.toFixed(4)),
          retrievedAt,
          metadata: chunk.metadata || {},
        });
      }
    }

    // Sort descending by similarity score
    scoredResults.sort((a, b) => b.similarity - a.similarity);

    return scoredResults.slice(0, topK);
  }

  /**
   * Rebuilds the entire vector index from SQLite database, computing embeddings if missing.
   */
  public async rebuildIndexFromDatabase(): Promise<{ totalIndexed: number }> {
    await ensureDatabaseReady();
    const rows = await db.select().from(documentChunksTable);
    const provider = this.getProvider();

    this.chunksMap.clear();
    let indexedCount = 0;

    for (const row of rows) {
      let embedding: number[] = [];
      if (row.embedding) {
        embedding = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
      }

      // If embedding missing or empty, regenerate and update SQLite
      if (!embedding || embedding.length === 0) {
        embedding = await provider.embedQuery(row.content);
        await db
          .update(documentChunksTable)
          .set({ embedding: embedding as any })
          .where(eq(documentChunksTable.id, row.id));
      }

      const chunk: DocumentChunk = {
        id: row.id,
        documentId: row.documentId,
        chunkIndex: row.chunkIndex,
        content: row.content,
        page: row.page,
        source: row.source,
        tokenEstimate: row.tokenEstimate,
        embedding,
        metadata: (row.metadata as any) || {},
        createdAt: row.createdAt,
      };

      this.chunksMap.set(chunk.id, chunk);
      indexedCount++;
    }

    this.isInitialized = true;
    return { totalIndexed: indexedCount };
  }

  public getChunkCount(): number {
    return this.chunksMap.size;
  }
}

export const defaultVectorIndex = new VectorIndex();
