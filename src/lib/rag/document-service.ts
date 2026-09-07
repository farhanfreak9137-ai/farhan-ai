import crypto from 'crypto';
import { db, ensureDatabaseReady } from '@/lib/db';
import { documents as documentsTable, documentChunks as documentChunksTable } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Document, DocumentMetadata, DocumentChunk, IngestionResult, RetrievalResult } from './types';
import { ExtractorRegistry } from './extractors';
import { TextChunker } from './chunker';
import { resolveEmbeddingProvider, EmbeddingProvider } from './embeddings';
import { VectorIndex, defaultVectorIndex } from './vector-index';

export interface IngestDocumentParams {
  filename: string;
  content: Buffer | string;
  title?: string;
  type?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export class DocumentService {
  private chunker: TextChunker;
  private vectorIndex: VectorIndex;
  private embeddingProvider?: EmbeddingProvider;

  constructor(vectorIndex: VectorIndex = defaultVectorIndex, embeddingProvider?: EmbeddingProvider) {
    this.vectorIndex = vectorIndex;
    this.embeddingProvider = embeddingProvider;
    this.chunker = new TextChunker();
  }

  private getProvider(): EmbeddingProvider {
    return this.embeddingProvider || resolveEmbeddingProvider();
  }

  /**
   * Computes SHA-256 checksum of raw content for incremental indexing and deduplication.
   */
  public static computeChecksum(buffer: Buffer | string): string {
    const hash = crypto.createHash('sha256');
    hash.update(typeof buffer === 'string' ? Buffer.from(buffer, 'utf-8') : buffer);
    return hash.digest('hex');
  }

  /**
   * Ingests, extracts, chunks, embeds, and persists a document into SQLite and Vector Index.
   */
  public async ingestDocument(params: IngestDocumentParams): Promise<IngestionResult> {
    await ensureDatabaseReady();

    const { filename, content, source = 'user_upload', metadata = {} } = params;

    // Security & file size limits: max 10MB
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${(buffer.length / (1024 * 1024)).toFixed(2)}MB exceeds maximum allowed limit of 10MB.`);
    }

    if (buffer.length === 0) {
      throw new Error(`Cannot ingest empty file: '${filename}'.`);
    }

    // Sanitize filename against directory traversal
    const safeFilename = filename.replace(/^.*[\\\/]/, '').trim() || 'document.txt';
    const checksum = DocumentService.computeChecksum(buffer);

    // Check if document with matching checksum already exists (skip redundant re-indexing)
    const existing = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.checksum, checksum))
      .limit(1);

    if (existing.length > 0) {
      const existingDoc = existing[0];
      const chunks = await db
        .select()
        .from(documentChunksTable)
        .where(eq(documentChunksTable.documentId, existingDoc.id));

      return {
        success: true,
        document: {
          id: existingDoc.id,
          title: existingDoc.title,
          filename: existingDoc.filename || safeFilename,
          type: existingDoc.type,
          source: existingDoc.source || source,
          size: existingDoc.size || buffer.length,
          checksum: existingDoc.checksum || checksum,
          status: 'indexed',
          chunkCount: chunks.length,
          metadata: (existingDoc.metadata as any) || {},
          addedAt: existingDoc.addedAt,
          updatedAt: existingDoc.updatedAt || undefined,
        },
        chunksCreated: chunks.length,
      };
    }

    // 1. Text Extraction
    const extracted = await ExtractorRegistry.extract(buffer, safeFilename);
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const title = params.title || safeFilename.replace(/\.[^/.]+$/, '');
    const docType = params.type || extracted.detectedType;

    // 2. Text Chunking
    const chunks = this.chunker.chunkDocument({
      documentId,
      text: extracted.text,
      source,
      pages: extracted.pages,
      metadata: {
        ...metadata,
        ...extracted.metadata,
        documentTitle: title,
        filename: safeFilename,
      },
    });

    if (chunks.length === 0) {
      throw new Error(`Text extraction produced 0 usable text chunks for '${safeFilename}'.`);
    }

    // 3. Embedding Generation
    const provider = this.getProvider();
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await provider.embedBatch(chunkTexts);

    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i] || [];
    }

    // 4. Persistence into SQLite Canonical Tables
    await db.insert(documentsTable).values({
      id: documentId,
      title,
      filename: safeFilename,
      type: docType,
      content: extracted.text,
      source,
      size: buffer.length,
      checksum,
      status: 'indexed',
      metadata: {
        ...metadata,
        ...extracted.metadata,
        chunkCount: chunks.length,
      } as any,
      addedAt: now,
      updatedAt: now,
    });

    for (const chunk of chunks) {
      await db.insert(documentChunksTable).values({
        id: chunk.id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        page: chunk.page || null,
        source: chunk.source,
        tokenEstimate: chunk.tokenEstimate,
        embedding: chunk.embedding as any,
        metadata: chunk.metadata as any,
        createdAt: chunk.createdAt,
      });

      // Update in-memory vector index cache
      this.vectorIndex.indexChunk(chunk);
    }

    const docMeta: DocumentMetadata = {
      id: documentId,
      title,
      filename: safeFilename,
      type: docType,
      source,
      size: buffer.length,
      checksum,
      status: 'indexed',
      chunkCount: chunks.length,
      metadata: {
        ...metadata,
        ...extracted.metadata,
      },
      addedAt: now,
      updatedAt: now,
    };

    return {
      success: true,
      document: docMeta,
      chunksCreated: chunks.length,
    };
  }

  /**
   * Lists all indexed documents with metadata and chunk counts.
   */
  public async listDocuments(filter: { type?: string; status?: string } = {}): Promise<DocumentMetadata[]> {
    await ensureDatabaseReady();
    const docs = await db.select().from(documentsTable).orderBy(desc(documentsTable.addedAt));

    const result: DocumentMetadata[] = [];
    for (const doc of docs) {
      if (filter.type && doc.type !== filter.type) continue;
      if (filter.status && doc.status !== filter.status) continue;

      const chunkCountRow = await db
        .select()
        .from(documentChunksTable)
        .where(eq(documentChunksTable.documentId, doc.id));

      result.push({
        id: doc.id,
        title: doc.title,
        filename: doc.filename || `${doc.title}.txt`,
        type: doc.type,
        source: doc.source || 'user_upload',
        size: doc.size || doc.content.length,
        checksum: doc.checksum || '',
        status: (doc.status as any) || 'indexed',
        chunkCount: chunkCountRow.length,
        metadata: (doc.metadata as any) || {},
        addedAt: doc.addedAt,
        updatedAt: doc.updatedAt || undefined,
      });
    }

    return result;
  }

  /**
   * Retrieves single document by ID including its chunks.
   */
  public async getDocument(id: string): Promise<{ document: Document; chunks: DocumentChunk[] } | null> {
    await ensureDatabaseReady();
    const rows = await db.select().from(documentsTable).where(eq(documentsTable.id, id)).limit(1);
    if (rows.length === 0) return null;

    const row = rows[0];
    const chunkRows = await db
      .select()
      .from(documentChunksTable)
      .where(eq(documentChunksTable.documentId, id))
      .orderBy(documentChunksTable.chunkIndex);

    const chunks: DocumentChunk[] = chunkRows.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      page: c.page,
      source: c.source,
      tokenEstimate: c.tokenEstimate,
      embedding: typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding,
      metadata: (c.metadata as any) || {},
      createdAt: c.createdAt,
    }));

    return {
      document: {
        id: row.id,
        title: row.title,
        filename: row.filename || `${row.title}.txt`,
        type: row.type,
        content: row.content,
        source: row.source || 'user_upload',
        size: row.size || row.content.length,
        checksum: row.checksum || '',
        status: (row.status as any) || 'indexed',
        chunkCount: chunks.length,
        metadata: (row.metadata as any) || {},
        addedAt: row.addedAt,
        updatedAt: row.updatedAt || undefined,
      },
      chunks,
    };
  }

  /**
   * Deletes document and its chunks from SQLite and the vector index.
   */
  public async deleteDocument(id: string): Promise<boolean> {
    await ensureDatabaseReady();

    // Remove from SQLite
    await db.delete(documentChunksTable).where(eq(documentChunksTable.documentId, id));
    await db.delete(documentsTable).where(eq(documentsTable.id, id));

    // Evict from VectorIndex
    this.vectorIndex.removeDocument(id);
    return true;
  }

  /**
   * Performs semantic retrieval over personal document chunks.
   */
  public async search(
    query: string,
    options: { topK?: number; minSimilarity?: number; documentFilter?: string; sourceFilter?: string } = {}
  ): Promise<RetrievalResult[]> {
    return this.vectorIndex.search(query, options);
  }

  /**
   * Rebuilds vector index from SQLite database.
   */
  public async rebuildIndex(): Promise<{ totalIndexed: number }> {
    return this.vectorIndex.rebuildIndexFromDatabase();
  }
}

export const defaultDocumentService = new DocumentService();
