import { LLMProvider, ProviderId, ProviderInfo, ChatMessage, ChatOptions } from './types';
import { GeminiProvider } from './providers/gemini';
import { OpenAICompatibleProvider } from './providers/openai-compatible';
import { MockProvider } from './providers/mock';
import { checkOllamaHealth, listInstalledOllamaModels } from './ollama';

/**
 * Inspects environment variables and returns baseline metadata on all supported providers.
 */
export function getAvailableProviders(): ProviderInfo[] {
  return [
    {
      id: 'gemini',
      name: 'Google Gemini (1M+ Token Context)',
      defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contextWindow: '1,000,000+ tokens',
      configured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== ''),
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o)',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
      contextWindow: '128,000 tokens',
      configured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== ''),
    },
    {
      id: 'groq',
      name: 'Groq (Ultra-Fast Llama 3.3)',
      defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      contextWindow: '128,000 tokens',
      configured: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim() !== ''),
    },
    {
      id: 'ollama',
      name: 'Local LLM (Ollama Offline)',
      defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
      contextWindow: '32,000 tokens',
      configured: Boolean(process.env.OLLAMA_ENABLED === 'true' || process.env.OLLAMA_BASE_URL),
    },
    {
      id: 'local_fastpath',
      name: 'Offline Fast-Path (0 Tokens, Native Python)',
      defaultModel: 'windows-native-pc-controller',
      contextWindow: 'Instantaneous OS Control',
      configured: true,
    },
    {
      id: 'mock',
      name: 'Auren AI Mock (Deterministic)',
      defaultModel: 'deterministic-career-engine',
      contextWindow: 'Unlimited',
      configured: true,
    },
  ];
}

/**
 * Dynamically queries live local services (such as Ollama on localhost:11434)
 * to provide real-time status and installed local model lists.
 */
export async function getAvailableProvidersAsync(): Promise<ProviderInfo[]> {
  const baseProviders = getAvailableProviders();
  try {
    const health = await checkOllamaHealth(1000);
    const ollamaProvider = baseProviders.find((p) => p.id === 'ollama');

    if (ollamaProvider) {
      if (health.running) {
        ollamaProvider.configured = true;
        const models = await listInstalledOllamaModels(1500);
        ollamaProvider.installedModels = models.map((m) => m.name);
        if (models.length > 0) {
          ollamaProvider.defaultModel = process.env.OLLAMA_MODEL || models[0].name;
          ollamaProvider.name = `Local Ollama (${models.length} model${models.length === 1 ? '' : 's'})`;
        }
      }
    }
  } catch (err) {
    console.warn('Ollama dynamic discovery error:', err);
  }
  return baseProviders;
}

/**
 * Creates an instance of the requested LLM provider.
 */
export function createProvider(id: ProviderId): LLMProvider {
  switch (id) {
    case 'gemini': {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim() === '') {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      return new GeminiProvider();
    }
    case 'openai': {
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
        throw new Error('OPENAI_API_KEY is not configured');
      }
      return new OpenAICompatibleProvider({
        id: 'openai',
        name: 'OpenAI',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
      });
    }
    case 'groq': {
      if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.trim() === '') {
        throw new Error('GROQ_API_KEY is not configured');
      }
      return new OpenAICompatibleProvider({
        id: 'groq',
        name: 'Groq',
        apiKey: process.env.GROQ_API_KEY,
        baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        defaultModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      });
    }
    case 'ollama': {
      return new OpenAICompatibleProvider({
        id: 'ollama',
        name: 'Local Ollama',
        apiKey: 'ollama-local',
        baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
        defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
      });
    }
    case 'local_fastpath':
    case 'mock':
    default:
      return new MockProvider();
  }
}

/**
 * Resolves the primary provider based on user request or environment setting.
 */
export function resolveProvider(requestedId?: ProviderId): LLMProvider {
  const envProvider = (process.env.AI_PROVIDER || 'mock') as ProviderId;
  const targetId = requestedId || envProvider;
  try {
    return createProvider(targetId);
  } catch {
    return new MockProvider();
  }
}

/**
 * Multi-API Failover Orchestrator:
 * Executes a streaming chat request with automatic rollover to backup providers
 * if rate limits (429) or connection issues occur.
 */
export async function streamChatWithFallback(
  messages: ChatMessage[],
  options?: ChatOptions,
  preferredId?: ProviderId
): Promise<{ stream: ReadableStream<string>; providerUsed: ProviderId }> {
  const providers = getAvailableProviders();
  
  const defaultPreferred = (process.env.AI_PROVIDER || process.env.PRIMARY_PROVIDER || 'ollama') as ProviderId;
  const targetPreferred = preferredId || defaultPreferred;

  // Prioritize preferred provider, then other configured providers, then mock
  const order: ProviderId[] = [];
  if (targetPreferred && targetPreferred !== 'mock') order.push(targetPreferred);
  
  providers
    .filter((p) => p.configured && p.id !== 'mock' && !order.includes(p.id))
    .forEach((p) => order.push(p.id));
    
  order.push('mock'); // Final safety net

  for (const providerId of order) {
    try {
      const provider = createProvider(providerId);
      const stream = await provider.streamChat(messages, options);
      return { stream, providerUsed: provider.id };
    } catch (err) {
      console.warn(`[Farhan AI Failover] Provider ${providerId} unavailable or failed. Attempting next provider...`, err instanceof Error ? err.message : err);
    }
  }

  // If even mock failed (should never happen), return a minimal fallback stream
  const mock = new MockProvider();
  const stream = await mock.streamChat(messages, options);
  return { stream, providerUsed: 'mock' };
}
