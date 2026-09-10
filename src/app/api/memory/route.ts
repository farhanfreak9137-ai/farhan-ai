import { NextRequest, NextResponse } from 'next/server';
import {
  getMemoriesAsync,
  addMemoryAsync,
  deleteMemoryAsync,
  verifyMemoryAsync,
  invalidateMemoryAsync,
  searchMemoriesAsync,
  getMemoryEventsAsync,
  MemoryCategory,
} from '@/lib/memory/store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') as MemoryCategory | null;
    const status = searchParams.get('status') || undefined;
    const verifiedOnly = searchParams.get('verified') === 'true';

    const all = await getMemoriesAsync();
    let filtered = all;

    if (category) {
      filtered = filtered.filter((m) => m.category === category);
    }
    if (status) {
      filtered = filtered.filter((m) => m.status === status);
    }
    if (verifiedOnly) {
      filtered = filtered.filter((m) => m.verified);
    }

    return NextResponse.json({ success: true, memories: filtered, total: filtered.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch memories';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Normalize memory ID: accept both body.id and body.memoryId
    const memoryId: string | undefined = body.id || body.memoryId;

    if (body.action === 'add' || body.action === 'create') {
      const { category, title, content, confidence, source, verified } = body.memory || body;
      if (!title || !content) {
        return NextResponse.json({ error: 'Title and content required' }, { status: 400 });
      }

      const created = await addMemoryAsync({
        category: category || 'FACT',
        title,
        content,
        confidence: confidence !== undefined ? Number(confidence) : 0.9,
        source: source || 'user_interaction',
        verified: Boolean(verified),
      });

      return NextResponse.json({ success: true, memory: created });
    }

    if (body.action === 'search') {
      const { query, category, minConfidence, verifiedOnly, topK } = body;
      if (!query) {
        return NextResponse.json({ error: 'Query is required for memory search' }, { status: 400 });
      }

      const results = await searchMemoriesAsync(query, {
        category,
        minConfidence,
        verifiedOnly,
        topK,
      });

      return NextResponse.json({ success: true, query, memories: results, count: results.length });
    }

    if (body.action === 'verify') {
      if (!memoryId) {
        return NextResponse.json({ error: 'Memory ID is required (pass id or memoryId)' }, { status: 400 });
      }
      const ok = await verifyMemoryAsync(memoryId);
      return NextResponse.json({ success: ok, memoryId });
    }

    if (body.action === 'invalidate') {
      if (!memoryId) {
        return NextResponse.json({ error: 'Memory ID is required (pass id or memoryId)' }, { status: 400 });
      }
      const ok = await invalidateMemoryAsync(memoryId, body.reason);
      return NextResponse.json({ success: ok, memoryId });
    }

    if (body.action === 'delete') {
      if (!memoryId) {
        return NextResponse.json({ error: 'Memory ID is required (pass id or memoryId)' }, { status: 400 });
      }
      const ok = await deleteMemoryAsync(memoryId);
      return NextResponse.json({ success: ok, memoryId });
    }

    if (body.action === 'events') {
      if (!memoryId) {
        return NextResponse.json({ error: 'Memory ID is required (pass id or memoryId)' }, { status: 400 });
      }
      const events = await getMemoryEventsAsync(memoryId);
      return NextResponse.json({ success: true, memoryId, events });
    }

    return NextResponse.json({ error: `Unknown action: '${body.action}'. Valid actions: add, search, verify, invalidate, delete, events` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Memory store error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
