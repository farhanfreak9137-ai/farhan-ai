import { NextRequest, NextResponse } from 'next/server';
import { defaultDocumentService } from '@/lib/rag/document-service';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await defaultDocumentService.getDocument(id);
    if (!data) {
      return NextResponse.json({ error: `Document '${id}' not found` }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve document';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ok = await defaultDocumentService.deleteDocument(id);
    return NextResponse.json({ success: ok, documentId: id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete document';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
