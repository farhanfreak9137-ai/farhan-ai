import { ChatMessage, ProviderId } from './types';
import { getAvailableProviders } from './factory';

export interface RouteDecision {
  providerId: ProviderId;
  rationale: string;
  contextSizeEstimate: number;
}

/**
 * Evaluates conversation depth, content length, and user intent to intelligently
 * route requests to the most optimal AI model.
 */
export function routeRequest(messages: ChatMessage[]): RouteDecision {
  const totalLength = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
  const latestMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
  const providers = getAvailableProviders();

  // Rule 1: Massive context or document ingestion -> Gemini (1,000,000+ token context)
  if (totalLength > 12000 || latestMessage.includes('document') || latestMessage.includes('full cv')) {
    const gemini = providers.find((p) => p.id === 'gemini' && p.configured);
    if (gemini) {
      return {
        providerId: 'gemini',
        rationale: 'Extensive context / document payload detected — routed to Google Gemini (1M+ Token Window).',
        contextSizeEstimate: totalLength,
      };
    }
  }

  // Rule 2: Explicit local / private request
  if (latestMessage.includes('local') || latestMessage.includes('offline') || latestMessage.includes('privacy')) {
    const ollama = providers.find((p) => p.id === 'ollama' && p.configured);
    if (ollama) {
      return {
        providerId: 'ollama',
        rationale: 'Privacy / local execution requested — routed to Local Ollama.',
        contextSizeEstimate: totalLength,
      };
    }
    return {
      providerId: 'mock',
      rationale: 'Local execution requested — using offline mock engine.',
      contextSizeEstimate: totalLength,
    };
  }

  // Rule 3: Configured primary provider priority (defaults to local Ollama for unlimited offline requests)
  const preferred = (process.env.AI_PROVIDER || process.env.PRIMARY_PROVIDER || 'ollama').toLowerCase();
  const matchedPreferred = providers.find((p) => p.id === preferred && p.configured);
  if (matchedPreferred) {
    return {
      providerId: matchedPreferred.id,
      rationale: `Routed to primary engine (${matchedPreferred.name}) — zero token quotas.`,
      contextSizeEstimate: totalLength,
    };
  }

  // Fallback to Ollama if configured
  if (providers.find((p) => p.id === 'ollama' && p.configured)) {
    return {
      providerId: 'ollama',
      rationale: 'Routed to Local Ollama for unlimited requests and zero external API limits.',
      contextSizeEstimate: totalLength,
    };
  }

  if (providers.find((p) => p.id === 'gemini' && p.configured)) {
    return {
      providerId: 'gemini',
      rationale: 'Routed to Gemini 2.5 Flash.',
      contextSizeEstimate: totalLength,
    };
  }

  if (providers.find((p) => p.id === 'openai' && p.configured)) {
    return {
      providerId: 'openai',
      rationale: 'Routed to OpenAI GPT-4o.',
      contextSizeEstimate: totalLength,
    };
  }

  return {
    providerId: 'mock',
    rationale: 'Defaulting to Farhan AI Mock engine (zero external API keys required).',
    contextSizeEstimate: totalLength,
  };
}
