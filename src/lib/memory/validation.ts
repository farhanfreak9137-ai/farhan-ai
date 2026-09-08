import { MemoryCategory, MemoryItem, MemoryConflictResult } from './types';

export class MemoryValidator {
  /**
   * Detects whether a candidate memory conflicts with or supersedes an existing active memory.
   */
  public static detectConflict(
    newCandidate: { category: MemoryCategory; content: string; title?: string },
    existingMemories: MemoryItem[]
  ): MemoryConflictResult {
    const activeMemories = existingMemories.filter((m) => m.status === 'active');
    const newContentLower = newCandidate.content.toLowerCase();

    // Check conflict by category
    if (newCandidate.category === 'PREFERENCE') {
      // e.g. language/framework/work model preferences
      const preferenceKeyMatch = newContentLower.match(
        /(?:prefers|using|for)\s+([a-z0-9+#.-]+)/i
      );

      for (const existing of activeMemories) {
        if (existing.category !== 'PREFERENCE') continue;
        const existingLower = existing.content.toLowerCase();

        // Check if both discuss the same topic domain (e.g., frontend framework, language, remote work)
        const domains = [
          ['react', 'vue', 'angular', 'svelte', 'next.js', 'remix'],
          ['typescript', 'javascript', 'python', 'go', 'rust', 'java'],
          ['remote', 'hybrid', 'on-site', 'onsite'],
          ['backend', 'frontend', 'full-stack', 'full stack', 'systems'],
        ];

        for (const domain of domains) {
          const newHasDomain = domain.some((term) => newContentLower.includes(term));
          const existingHasDomain = domain.some((term) => existingLower.includes(term));

          if (newHasDomain && existingHasDomain) {
            return {
              hasConflict: true,
              conflictingMemoryId: existing.id,
              conflictReason: `New preference for [${domain.filter((t) => newContentLower.includes(t)).join(', ')}] supersedes previous preference [${existing.content}].`,
            };
          }
        }
      }
    }

    if (newCandidate.category === 'GOAL' || newCandidate.category === 'negotiation_goal') {
      const isSalaryGoal = newContentLower.includes('compensation') || newContentLower.includes('$') || newContentLower.includes('salary');

      for (const existing of activeMemories) {
        if (existing.category !== 'GOAL' && existing.category !== 'negotiation_goal') continue;
        const existingLower = existing.content.toLowerCase();

        if (isSalaryGoal && (existingLower.includes('compensation') || existingLower.includes('$') || existingLower.includes('salary'))) {
          return {
            hasConflict: true,
            conflictingMemoryId: existing.id,
            conflictReason: `Updated compensation target supersedes previous goal: '${existing.content}'.`,
          };
        }
      }
    }

    return { hasConflict: false };
  }
}
