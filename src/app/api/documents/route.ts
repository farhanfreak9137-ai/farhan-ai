import { NextRequest, NextResponse } from 'next/server';
import { defaultDocumentService } from '@/lib/rag/document-service';
import { z } from 'zod';
import path from 'node:path';

export const runtime = 'nodejs';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10MB limit

const DocumentIngestSchema = z.object({
  filename: z.string().min(1).max(255),
  content: z.string().min(1),
  title: z.string().max(255).optional(),
  type: z.string().max(50).optional(),
  source: z.string().max(255).optional(),
  isBase64: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;

    const documents = await defaultDocumentService.listDocuments({ type, status });
    return NextResponse.json({ success: true, documents, total: documents.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list documents';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parseResult = DocumentIngestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.issues.map((e) => ({
            path: e.path.map(String).join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { filename, content, title, type, source, isBase64, metadata } = parseResult.data;

    // Sanitize filename against directory traversal
    const sanitizedFilename = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    if (!sanitizedFilename || sanitizedFilename === '.' || sanitizedFilename === '..') {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    // Decode if base64 provided
    let buffer: Buffer;
    if (isBase64) {
      buffer = Buffer.from(content, 'base64');
    } else {
      buffer = Buffer.from(content, 'utf-8');
    }

    // Enforce payload size limit
    if (buffer.length > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        {
          error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)}MB) exceeds the maximum allowed limit of 10MB`,
        },
        { status: 413 }
      );
    }

    const result = await defaultDocumentService.ingestDocument({
      filename: sanitizedFilename,
      content: buffer,
      title,
      type,
      source: source || 'user_upload',
      metadata,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Document ingestion failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
