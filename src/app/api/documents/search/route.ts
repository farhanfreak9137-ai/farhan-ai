import { NextRequest, NextResponse } from 'next/server';
import { defaultDocumentService } from '@/lib/rag/document-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, topK, minSimilarity, documentFilter, sourceFilter } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query parameter is required' }, { status: 400 });
    }

    const results = await defaultDocumentService.search(query, {
      topK,
      minSimilarity,
      documentFilter,
      sourceFilter,
    });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
      retrievedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
