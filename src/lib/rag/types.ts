import { z } from 'zod';

export const DocumentTypeSchema = z.enum([
  'txt',
  'md',
  'json',
  'pdf',
  'cv',
  'cover_letter',
  'project_spec',
  'note',
  'certification',
  'other',
]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentStatusSchema = z.enum(['unindexed', 'indexing', 'indexed', 'failed']);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentMetadataSchema = z.object({
  id: z.string(),
  title: z.string(),
  filename: z.string().default('document.txt'),
  type: z.string(),
  source: z.string().default('user_upload'),
  size: z.number().default(0),
  checksum: z.string().default(''),
  status: DocumentStatusSchema.default('unindexed'),
  chunkCount: z.number().optional().default(0),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  addedAt: z.string(),
  updatedAt: z.string().optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const DocumentSchema = DocumentMetadataSchema.extend({
  content: z.string(),
});

export type Document = z.infer<typeof DocumentSchema>;

export const DocumentChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  chunkIndex: z.number(),
  content: z.string(),
  page: z.number().nullable().optional(),
  source: z.string(),
  tokenEstimate: z.number(),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  createdAt: z.string(),
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

export const RetrievalResultSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  source: z.string(),
  page: z.number().nullable().optional(),
  chunkIndex: z.number(),
  content: z.string(),
  similarity: z.number(),
  retrievedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

export interface IngestionResult {
  success: boolean;
  document?: DocumentMetadata;
  chunksCreated: number;
  error?: string;
}

export interface Embedding {
  vector: number[];
  dimensions: number;
  model: string;
}
