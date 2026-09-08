import { MemoryCategory } from './types';

export interface MemoryCandidate {
  category: MemoryCategory;
  title: string;
  content: string;
  confidence: number;
  source: string;
}

export class MemoryExtractor {
  private static TRANSIENT_PATTERNS = [
    /^(hi|hello|hey|greetings|thanks|thank you|ok|okay|got it|cool|great|bye|goodbye)[.!]?$/i,
    /^(how are you|what'?s up|can you help|what can you do)[.!?]?$/i,
    /^(yes|no|maybe|sure|yep|nope)[.!]?$/i,
  ];

  /**
   * Evaluates text for durable personal memory candidates.
   */
  public static extractFromText(text: string, source: string = 'user_chat'): MemoryCandidate[] {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 5) return [];

    // Filter out transient chatter
    for (const pattern of this.TRANSIENT_PATTERNS) {
      if (pattern.test(trimmed)) {
        return [];
      }
    }

    const candidates: MemoryCandidate[] = [];

    // 1. Preferences
    const preferenceMatch = trimmed.match(
      /(?:i\s+(?:prefer|always\s+use|enjoy\s+using|like\s+working\s+with|focus\s+on)|my\s+preferred\s+(?:stack|language|framework|setup|role|work\s+model)\s+is)\s+([^.!?]+)/i
    );
    if (preferenceMatch) {
      const subject = preferenceMatch[1].trim();
      candidates.push({
        category: 'PREFERENCE',
        title: `Preference: ${subject.slice(0, 40)}`,
        content: `User prefers ${subject}.`,
        confidence: 0.95,
        source,
      });
    }

    // 2. Career Goals & Target Compensation
    const goalMatch = trimmed.match(
      /(?:my\s+goal\s+is|target\s+compensation\s+(?:is|of)|aiming\s+for|targeting|i\s+want\s+to\s+(?:reach|achieve|target|work\s+as))\s+([^.!?]+)/i
    );
    if (goalMatch) {
      const goal = goalMatch[1].trim();
      candidates.push({
        category: 'GOAL',
        title: `Career Goal: ${goal.slice(0, 40)}`,
        content: `Target objective: ${goal}.`,
        confidence: 0.95,
        source,
      });
    }

    // 3. Project Context
    const projectMatch = trimmed.match(
      /(?:i\s+(?:built|developed|created|architected|am\s+building|am\s+working\s+on))\s+([^.!?]+)/i
    );
    if (projectMatch) {
      const proj = projectMatch[1].trim();
      // Exclude simple ephemeral activities
      if (!/^(a\s+sandwich|breakfast|lunch|dinner|a\s+walk)/i.test(proj)) {
        candidates.push({
          category: 'PROJECT',
          title: `Project: ${proj.slice(0, 40)}`,
          content: `Built/engineered ${proj}.`,
          confidence: 0.85,
          source,
        });
      }
    }

    // 4. Skills & Competencies
    const skillMatch = trimmed.match(
      /(?:i\s+have\s+(?:extensive\s+|deep\s+|proven\s+)?experience\s+(?:with|in)|i\s+am\s+proficient\s+in|specializ(?:ed|ing)\s+in)\s+([^.!?]+)/i
    );
    if (skillMatch) {
      const skill = skillMatch[1].trim();
      candidates.push({
        category: 'SKILL',
        title: `Skill Competency: ${skill.slice(0, 40)}`,
        content: `Proficient in ${skill}.`,
        confidence: 0.9,
        source,
      });
    }

    // 5. Career Events & Interview Notes
    const eventMatch = trimmed.match(
      /(?:interview(?:ed)?\s+(?:with|at)|had\s+an\s+interview\s+(?:with|at)|talked\s+to\s+(?:the\s+recruiter|hiring\s+manager)\s+at)\s+([A-Z][a-zA-Z0-9\s]+?)(?:[.!?]|$)/i
    );
    if (eventMatch) {
      const company = eventMatch[1].trim();
      candidates.push({
        category: 'CAREER_EVENT',
        title: `Interview Milestone: ${company}`,
        content: trimmed,
        confidence: 0.9,
        source,
      });
    }

    return candidates;
  }
}
