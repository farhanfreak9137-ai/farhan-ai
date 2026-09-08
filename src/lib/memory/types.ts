import { z } from 'zod';

export const MemoryCategorySchema = z.enum([
  'FACT',
  'PREFERENCE',
  'GOAL',
  'PROJECT',
  'SKILL',
  'EXPERIENCE',
  'CAREER_EVENT',
  'CONVERSATION',
  // Legacy categories mapped for backward compatibility
  'interview_feedback',
  'career_reflection',
  'negotiation_goal',
  'recruiter_note',
]);

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

export const MemoryStatusSchema = z.enum(['active', 'superseded', 'invalidated', 'archived']);
export type MemoryStatus = z.infer<typeof MemoryStatusSchema>;

export const MemoryItemSchema = z.object({
  id: z.string(),
  category: MemoryCategorySchema,
  title: z.string(),
  content: z.string(),
  source: z.string().default('user_interaction'),
  confidence: z.number().min(0).max(1).default(0.9),
  verified: z.boolean().default(false),
  status: MemoryStatusSchema.default('active'),
  supersededBy: z.string().nullable().optional(),
  supersedes: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  sourceDocumentId: z.string().nullable().optional(),
  sourceConversationId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export type MemoryItem = z.infer<typeof MemoryItemSchema>;

export const MemoryEventTypeSchema = z.enum([
  'created',
  'updated',
  'verified',
  'invalidated',
  'superseded',
  'conflict_detected',
]);

export type MemoryEventType = z.infer<typeof MemoryEventTypeSchema>;

export interface MemoryEvent {
  id: string;
  memoryId: string;
  eventType: MemoryEventType;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryConflictResult {
  hasConflict: boolean;
  conflictingMemoryId?: string;
  conflictReason?: string;
}
