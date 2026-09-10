import { NextResponse } from 'next/server';
import { defaultDocumentService } from '@/lib/rag/document-service';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const result = await defaultDocumentService.rebuildIndex();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rebuild vector index';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
