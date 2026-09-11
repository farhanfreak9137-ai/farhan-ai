export interface OllamaModelInfo {
  name: string;
  size: number; // in bytes
  digest: string;
  modifiedAt: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface RecommendedModel {
  id: string;
  name: string;
  parameterSize: string;
  ramRequired: string;
  description: string;
  recommendedFor: string;
  speedRating: 'Fast' | 'Ultra-Fast' | 'Moderate';
  supportsTools: boolean;
}

// Recommended lightweight models optimized for 8GB RAM + Intel CPU
export const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    id: 'qwen2.5:1.5b',
    name: 'Qwen 2.5 1.5B',
    parameterSize: '1.5B',
    ramRequired: '~1.1 GB',
    description: 'Blazing fast, state-of-the-art multilingual & coding reasoning with native tool-calling.',
    recommendedFor: 'Best overall performance on 8GB RAM PCs (Ultra-responsive)',
    speedRating: 'Ultra-Fast',
    supportsTools: true,
  },
  {
    id: 'llama3.2:3b',
    name: 'Meta Llama 3.2 3B',
    parameterSize: '3.2B',
    ramRequired: '~2.0 GB',
    description: "Meta's flagship compact model for edge devices, instruction-following, and natural dialogue.",
    recommendedFor: 'Excellent conversational balance and task comprehension',
    speedRating: 'Fast',
    supportsTools: true,
  },
  {
    id: 'deepseek-r1:1.5b',
    name: 'DeepSeek-R1 1.5B',
    parameterSize: '1.5B',
    ramRequired: '~1.1 GB',
    description: 'Specialized local chain-of-thought mathematical and logic reasoning engine.',
    recommendedFor: 'Complex algorithmic thinking and step-by-step deduction',
    speedRating: 'Fast',
    supportsTools: false,
  },
  {
    id: 'qwen2.5:3b',
    name: 'Qwen 2.5 3B',
    parameterSize: '3B',
    ramRequired: '~2.2 GB',
    description: 'Higher precision coding, technical Q&A, and advanced tool calling.',
    recommendedFor: 'Detailed technical analysis when slightly more RAM is free',
    speedRating: 'Fast',
    supportsTools: true,
  },
  {
    id: 'llama3.2:1b',
    name: 'Meta Llama 3.2 1B',
    parameterSize: '1B',
    ramRequired: '~0.9 GB',
    description: 'Featherlight Meta model with minimal CPU/RAM footprint.',
    recommendedFor: 'Lowest possible memory usage, instant response times',
    speedRating: 'Ultra-Fast',
    supportsTools: true,
  },
];

const rawOllamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_BASE_URL = rawOllamaUrl.replace(/\/v1\/?$/, '');

/**
 * Checks if Ollama service is reachable on localhost:11434.
 */
export async function checkOllamaHealth(timeoutMs = 1500): Promise<{
  running: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/version`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { running: true, version: data.version || '0.34.0+' };
    }
    return { running: false, error: `HTTP ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unreachable';
    return { running: false, error: msg };
  }
}

/**
 * Lists all locally downloaded models from Ollama.
 */
export async function listInstalledOllamaModels(timeoutMs = 2500): Promise<OllamaModelInfo[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();
    return (data.models || []).map((m: any) => ({
      name: m.name,
      size: m.size || 0,
      digest: m.digest || '',
      modifiedAt: m.modified_at || '',
      details: m.details,
    }));
  } catch {
    return [];
  }
}

/**
 * Pulls a model from the Ollama library.
 */
export async function pullOllamaModel(modelName: string): Promise<ReadableStream<string>> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Failed to initiate pull for ${modelName}: HTTP ${res.status}`);
  }

  return res.body as unknown as ReadableStream<string>;
}
