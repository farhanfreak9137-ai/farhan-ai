import { db, ensureDatabaseReady } from '@/lib/db';
import { memories, memoryEvents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { MemoryItem, MemoryCategory, MemoryStatus, MemoryEvent } from './types';
import { MemoryValidator } from './validation';

export * from './types';
export * from './extraction';
export * from './validation';

let cachedMemories: MemoryItem[] = [
  {
    id: 'mem-1',
    category: 'EXPERIENCE',
    title: 'Nexus Cognitive Lab Technical Screen',
    content: "Hiring manager was impressed by Farhan's quantified achievements (45% latency reduction via autonomous workflows and Next.js App Router migrations). Recommended emphasizing agentic tool calling in the next technical round.",
    source: 'interview_takeaway',
    confidence: 0.95,
    verified: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    category: 'GOAL',
    title: 'Target Compensation & Autonomy',
    content: 'Targeting base compensation of $150,000+ USD with equity for senior AI roles. Key non-negotiables: 100% remote flexibility and ownership over agentic architecture.',
    source: 'career_strategy',
    confidence: 0.95,
    verified: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-3',
    category: 'PREFERENCE',
    title: 'Engineering Philosophy & Stack',
    content: 'Always advocate for type-safe interfaces (Zod/TypeScript), multi-provider failover, and strict factual boundaries before pushing LLMs to production.',
    source: 'engineering_reflection',
    confidence: 0.95,
    verified: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let isMemoriesLoaded = false;
let memoriesLoadPromise: Promise<void> | null = null;

function mapRowToMemory(r: typeof memories.$inferSelect): MemoryItem {
  return {
    id: r.id,
    category: (r.category as MemoryCategory) || 'FACT',
    title: r.title,
    content: r.content,
    source: r.source || 'user_interaction',
    confidence: typeof r.confidence === 'number' ? r.confidence : 0.9,
    verified: Boolean(r.verified),
    status: (r.status as MemoryStatus) || 'active',
    supersededBy: r.supersededBy || undefined,
    supersedes: r.supersedes || undefined,
    expiresAt: r.expiresAt || undefined,
    sourceDocumentId: r.sourceDocumentId || undefined,
    sourceConversationId: r.sourceConversationId || undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt || undefined,
  };
}

/**
 * Ensures cached memories are synchronized from SQLite database without race conditions.
 */
export async function ensureMemoriesLoaded(): Promise<void> {
  if (isMemoriesLoaded) return;
  if (!memoriesLoadPromise) {
    memoriesLoadPromise = (async () => {
      try {
        await ensureDatabaseReady();
        const rows = await db.select().from(memories).orderBy(desc(memories.createdAt));
        if (rows.length > 0) {
          cachedMemories = rows.map(mapRowToMemory);
        }
      } catch (err) {
        console.error('Error rehydrating memories from SQLite:', err);
      } finally {
        isMemoriesLoaded = true;
      }
    })();
  }
  return memoriesLoadPromise;
}

export function getMemories(): MemoryItem[] {
  return [...cachedMemories];
}

export function getMemoriesSync(): MemoryItem[] {
  return [...cachedMemories];
}

export async function getMemoriesAsync(): Promise<MemoryItem[]> {
  await ensureMemoriesLoaded();
  return getMemories();
}

/**
 * Adds memory synchronously with background persistence to SQLite.
 */
export function addMemory(item: Partial<MemoryItem> & { category: MemoryCategory; title: string; content: string }): MemoryItem {
  const now = new Date().toISOString();
  const newMem: MemoryItem = {
    id: item.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: item.category,
    title: item.title,
    content: item.content,
    source: item.source || 'user_interaction',
    confidence: item.confidence !== undefined ? item.confidence : 0.9,
    verified: Boolean(item.verified),
    status: item.status || 'active',
    supersededBy: item.supersededBy,
    supersedes: item.supersedes,
    expiresAt: item.expiresAt,
    sourceDocumentId: item.sourceDocumentId,
    sourceConversationId: item.sourceConversationId,
    createdAt: item.createdAt || now,
    updatedAt: now,
  };

  cachedMemories.unshift(newMem);

  ensureDatabaseReady()
    .then(async () => {
      await db.insert(memories).values({
        id: newMem.id,
        category: newMem.category,
        title: newMem.title,
        content: newMem.content,
        source: newMem.source,
        confidence: newMem.confidence,
        verified: newMem.verified,
        status: newMem.status,
        supersededBy: newMem.supersededBy || null,
        supersedes: newMem.supersedes || null,
        expiresAt: newMem.expiresAt || null,
        sourceDocumentId: newMem.sourceDocumentId || null,
        sourceConversationId: newMem.sourceConversationId || null,
        createdAt: newMem.createdAt,
        updatedAt: newMem.updatedAt || now,
      });

      // Audit log event
      await db.insert(memoryEvents).values({
        id: `mevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        memoryId: newMem.id,
        eventType: 'created',
        details: { content: newMem.content, category: newMem.category } as any,
        createdAt: now,
      });
    })
    .catch((err) => {
      console.error('Failed to persist memory to SQLite:', err);
    });

  return newMem;
}

/**
 * Adds a memory asynchronously with automatic conflict detection, supersession, and audit trail.
 */
export async function addMemoryAsync(
  item: Partial<MemoryItem> & { category: MemoryCategory; title: string; content: string }
): Promise<MemoryItem> {
  await ensureMemoriesLoaded();
  const now = new Date().toISOString();
  const newId = item.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. Conflict Detection & Supersession
  const conflict = MemoryValidator.detectConflict(item, cachedMemories);
  let supersedesId: string | undefined = item.supersedes || undefined;

  if (conflict.hasConflict && conflict.conflictingMemoryId) {
    supersedesId = conflict.conflictingMemoryId;

    // Mark previous memory as superseded in SQLite and cache
    await db
      .update(memories)
      .set({
        status: 'superseded',
        supersededBy: newId,
        updatedAt: now,
      })
      .where(eq(memories.id, conflict.conflictingMemoryId));

    const existingIdx = cachedMemories.findIndex((m) => m.id === conflict.conflictingMemoryId);
    if (existingIdx !== -1) {
      cachedMemories[existingIdx].status = 'superseded';
      cachedMemories[existingIdx].supersededBy = newId;
      cachedMemories[existingIdx].updatedAt = now;
    }

    // Record conflict & supersession audit events
    await db.insert(memoryEvents).values({
      id: `mevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memoryId: conflict.conflictingMemoryId,
      eventType: 'conflict_detected',
      details: {
        reason: conflict.conflictReason,
        supersededBy: newId,
      } as any,
      createdAt: now,
    });

    await db.insert(memoryEvents).values({
      id: `mevt-${Date.now() + 1}-${Math.random().toString(36).slice(2, 6)}`,
      memoryId: conflict.conflictingMemoryId,
      eventType: 'superseded',
      details: {
        supersededBy: newId,
      } as any,
      createdAt: now,
    });
  }

  const newMem: MemoryItem = {
    id: newId,
    category: item.category,
    title: item.title,
    content: item.content,
    source: item.source || 'user_interaction',
    confidence: item.confidence !== undefined ? item.confidence : 0.9,
    verified: Boolean(item.verified),
    status: item.status || 'active',
    supersededBy: item.supersededBy,
    supersedes: supersedesId,
    expiresAt: item.expiresAt,
    sourceDocumentId: item.sourceDocumentId,
    sourceConversationId: item.sourceConversationId,
    createdAt: item.createdAt || now,
    updatedAt: now,
  };

  await db.insert(memories).values({
    id: newMem.id,
    category: newMem.category,
    title: newMem.title,
    content: newMem.content,
    source: newMem.source,
    confidence: newMem.confidence,
    verified: newMem.verified,
    status: newMem.status,
    supersededBy: newMem.supersededBy || null,
    supersedes: newMem.supersedes || null,
    expiresAt: newMem.expiresAt || null,
    sourceDocumentId: newMem.sourceDocumentId || null,
    sourceConversationId: newMem.sourceConversationId || null,
    createdAt: newMem.createdAt,
    updatedAt: newMem.updatedAt || now,
  });

  await db.insert(memoryEvents).values({
    id: `mevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    memoryId: newMem.id,
    eventType: 'created',
    details: { content: newMem.content, category: newMem.category } as any,
    createdAt: now,
  });

  cachedMemories.unshift(newMem);
  return newMem;
}

/**
 * Marks a memory as verified by user.
 */
export async function verifyMemoryAsync(id: string): Promise<boolean> {
  await ensureMemoriesLoaded();
  const now = new Date().toISOString();

  const mem = cachedMemories.find((m) => m.id === id);
  if (!mem) return false;

  mem.verified = true;
  mem.updatedAt = now;

  await db.update(memories).set({ verified: true, updatedAt: now }).where(eq(memories.id, id));
  await db.insert(memoryEvents).values({
    id: `mevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    memoryId: id,
    eventType: 'verified',
    details: { verifiedAt: now } as any,
    createdAt: now,
  });

  return true;
}

/**
 * Invalidates a memory with an optional reason.
 */
export async function invalidateMemoryAsync(id: string, reason?: string): Promise<boolean> {
  await ensureMemoriesLoaded();
  const now = new Date().toISOString();

  const mem = cachedMemories.find((m) => m.id === id);
  if (!mem) return false;

  mem.status = 'invalidated';
  mem.updatedAt = now;

  await db.update(memories).set({ status: 'invalidated', updatedAt: now }).where(eq(memories.id, id));
  await db.insert(memoryEvents).values({
    id: `mevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    memoryId: id,
    eventType: 'invalidated',
    details: { reason: reason || 'User invalidated memory', invalidatedAt: now } as any,
    createdAt: now,
  });

  return true;
}

export function deleteMemory(id: string): boolean {
  const initial = cachedMemories.length;
  cachedMemories = cachedMemories.filter((m) => m.id !== id);
  const deleted = cachedMemories.length < initial;

  if (deleted) {
    ensureDatabaseReady()
      .then(async () => {
        await db.delete(memories).where(eq(memories.id, id));
      })
      .catch((err) => {
        console.error('Failed to delete memory from SQLite:', err);
      });
  }

  return deleted;
}

export async function deleteMemoryAsync(id: string): Promise<boolean> {
  await ensureMemoriesLoaded();
  const beforeCount = (await db.select().from(memories).where(eq(memories.id, id))).length;
  if (beforeCount === 0) return false;

  await db.delete(memories).where(eq(memories.id, id));
  cachedMemories = cachedMemories.filter((m) => m.id !== id);
  return true;
}

/**
 * Searches memories by query, category, confidence, and status.
 */
export async function searchMemoriesAsync(
  query: string,
  options: {
    category?: MemoryCategory;
    minConfidence?: number;
    verifiedOnly?: boolean;
    activeOnly?: boolean;
    topK?: number;
  } = {}
): Promise<MemoryItem[]> {
  await ensureMemoriesLoaded();

  const activeOnly = options.activeOnly !== undefined ? options.activeOnly : true;
  const minConfidence = options.minConfidence || 0;
  const topK = options.topK || 5;
  const queryLower = query.toLowerCase().trim();
  const terms = queryLower.split(/\s+/).filter(Boolean);

  let filtered = cachedMemories.filter((m) => {
    if (activeOnly && m.status !== 'active') return false;
    if (options.category && m.category !== options.category) return false;
    if (options.verifiedOnly && !m.verified) return false;
    if (m.confidence < minConfidence) return false;
    return true;
  });

  if (terms.length === 0) {
    return filtered.slice(0, topK);
  }

  // Rank by term match in title and content
  const scored = filtered.map((m) => {
    let score = 0;
    const titleLower = m.title.toLowerCase();
    const contentLower = m.content.toLowerCase();

    for (const term of terms) {
      if (titleLower.includes(term)) score += 3;
      if (contentLower.includes(term)) score += 2;
    }

    if (m.verified) score += 0.5;
    score += m.confidence;

    return { memory: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 1.0).map((s) => s.memory).slice(0, topK);
}

/**
 * Finds active memories matching a specific category.
 */
export async function findMemoriesByCategoryAsync(category: MemoryCategory): Promise<MemoryItem[]> {
  await ensureMemoriesLoaded();
  return cachedMemories.filter((m) => m.category === category && m.status === 'active');
}

/**
 * Retrieves audit event trail for a specific memory.
 */
export async function getMemoryEventsAsync(memoryId: string): Promise<MemoryEvent[]> {
  await ensureDatabaseReady();
  const rows = await db
    .select()
    .from(memoryEvents)
    .where(eq(memoryEvents.memoryId, memoryId))
    .orderBy(desc(memoryEvents.createdAt));

  return rows.map((r) => ({
    id: r.id,
    memoryId: r.memoryId,
    eventType: r.eventType as any,
    details: (r.details as any) || {},
    createdAt: r.createdAt,
  }));
}

/**
 * Formats active memories into an LLM context block.
 */
export function formatMemoriesForContext(memoriesList?: MemoryItem[]): string {
  const list = (memoriesList || cachedMemories).filter((m) => m.status === 'active');
  if (!list || list.length === 0) return '';

  let out = `### LONG-TERM CONTEXTUAL MEMORY & PERSONAL PREFERENCES\n`;
  list.forEach((m) => {
    const verifiedBadge = m.verified ? ' [VERIFIED]' : '';
    out += `- [${m.category}] ${m.title}${verifiedBadge}: ${m.content}\n`;
  });
  return out;
}

export async function formatMemoriesForContextAsync(): Promise<string> {
  await ensureMemoriesLoaded();
  return formatMemoriesForContext();
}
