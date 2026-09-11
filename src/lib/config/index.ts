import { z } from 'zod';

/**
 * Validated configuration schema for Farhan AI
 */
export const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEPLOYMENT_MODE: z.enum(['local_dev', 'private', 'production']).default('local_dev'),
  FARHAN_AUTH_TOKEN: z.string().optional().default(''),
  TRUSTED_PROXIES: z.string().optional().default(''),
  AI_PROVIDER: z.enum(['gemini', 'openai', 'groq', 'ollama', 'mock']).default('ollama'),
  OLLAMA_ENABLED: z.string().optional().default('true'),
  OLLAMA_BASE_URL: z.string().optional().default('http://localhost:11434/v1'),
  OLLAMA_MODEL: z.string().default('qwen2.5:1.5b'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  DATABASE_URL: z.string().optional().default(''),
  PORT: z.string().optional().default('3000'),
  STT_PROVIDER: z.enum(['mock', 'server', 'browser']).default('mock'),
  TTS_PROVIDER: z.enum(['mock', 'server', 'browser']).default('mock'),
});

export type AppConfig = z.infer<typeof ConfigSchema> & {
  isProduction: boolean;
  trustedProxiesList: string[];
};

let cachedConfig: AppConfig | null = null;

const WEAK_TOKEN_PATTERNS = [
  'change-me',
  'password',
  'secret',
  'test',
  '12345678',
  'admin',
  'token',
];

/**
 * Validates the runtime environment against strict production hardening requirements.
 */
export function validateConfig(rawEnv: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = ConfigSchema.parse(rawEnv);

  const deploymentMode = rawEnv.FARHAN_MODE || rawEnv.DEPLOYMENT_MODE || (parsed.NODE_ENV === 'production' ? 'production' : 'local_dev');
  const isProduction = deploymentMode === 'production';

  // Production security validations
  if (isProduction) {
    const token = parsed.FARHAN_AUTH_TOKEN?.trim();
    if (!token) {
      throw new Error(
        '[Security Hardening] FARHAN_AUTH_TOKEN is strictly required in production mode. Set a high-entropy secret token.'
      );
    }
    if (token.length < 16) {
      throw new Error(
        '[Security Hardening] FARHAN_AUTH_TOKEN must be at least 16 characters long in production mode.'
      );
    }
    if (WEAK_TOKEN_PATTERNS.some((weak) => token.toLowerCase().includes(weak))) {
      throw new Error(
        '[Security Hardening] FARHAN_AUTH_TOKEN appears to be a default or weak placeholder. Provide a cryptographically secure token.'
      );
    }

    // Provider credential check in production if not mock
    if (parsed.AI_PROVIDER === 'gemini' && !parsed.GEMINI_API_KEY) {
      throw new Error('[Security Hardening] GEMINI_API_KEY is required when AI_PROVIDER=gemini in production.');
    }
    if (parsed.AI_PROVIDER === 'openai' && !parsed.OPENAI_API_KEY) {
      throw new Error('[Security Hardening] OPENAI_API_KEY is required when AI_PROVIDER=openai in production.');
    }
    if (parsed.AI_PROVIDER === 'groq' && !parsed.GROQ_API_KEY) {
      throw new Error('[Security Hardening] GROQ_API_KEY is required when AI_PROVIDER=groq in production.');
    }
  }

  // Parse comma-separated trusted proxies
  const trustedProxiesList = (parsed.TRUSTED_PROXIES || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  return {
    ...parsed,
    DEPLOYMENT_MODE: deploymentMode as 'local_dev' | 'private' | 'production',
    isProduction,
    trustedProxiesList,
  };
}

/**
 * Get active configuration, cached as singleton.
 */
export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = validateConfig();
  }
  return cachedConfig;
}

/**
 * Clear cached config (primarily used in tests to test different environment modes)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Sanitized runtime diagnostics — safe to log or expose in diagnostic endpoints.
 * NEVER returns raw API keys or tokens.
 */
export function getConfigDiagnostics(): {
  mode: 'local_dev' | 'private' | 'production';
  nodeEnv: string;
  isProduction: boolean;
  aiProvider: string;
  hasGeminiKey: boolean;
  hasOpenAiKey: boolean;
  hasGroqKey: boolean;
  hasAuthToken: boolean;
  trustedProxiesCount: number;
  databaseConfigured: boolean;
} {
  const config = getConfig();
  return {
    mode: config.DEPLOYMENT_MODE,
    nodeEnv: config.NODE_ENV,
    isProduction: config.isProduction,
    aiProvider: config.AI_PROVIDER,
    hasGeminiKey: Boolean(config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 0),
    hasOpenAiKey: Boolean(config.OPENAI_API_KEY && config.OPENAI_API_KEY.length > 0),
    hasGroqKey: Boolean(config.GROQ_API_KEY && config.GROQ_API_KEY.length > 0),
    hasAuthToken: Boolean(config.FARHAN_AUTH_TOKEN && config.FARHAN_AUTH_TOKEN.length > 0),
    trustedProxiesCount: config.trustedProxiesList.length,
    databaseConfigured: Boolean(config.DATABASE_URL && config.DATABASE_URL.length > 0),
  };
}
