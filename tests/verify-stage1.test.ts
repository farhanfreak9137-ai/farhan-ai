import test from 'node:test';
import assert from 'node:assert/strict';

import { UserProfileSchema } from '@/lib/profile/schema';
import { defaultProfile } from '@/data/defaultProfile';
import { MockProvider } from '@/lib/ai/providers/mock';
import { buildSystemPrompt } from '@/lib/ai/prompts';
import { getAvailableProviders, createProvider, streamChatWithFallback } from '@/lib/ai/factory';

test('Profile Schema: validates realistic candidate profile correctly', () => {
  const parsed = UserProfileSchema.safeParse(defaultProfile);
  assert.equal(parsed.success, true, 'Default profile must satisfy UserProfileSchema');
  assert.equal(parsed.data?.personalInfo.fullName, 'Farhan');
  assert.ok((parsed.data?.skills.length || 0) > 0, 'Skills must not be empty');
  assert.ok((parsed.data?.experience.length || 0) > 0, 'Experience must not be empty');
});

test('Profile Schema: rejects corrupted profile without required fields', () => {
  const invalidProfile = {
    personalInfo: {
      bio: 'Just a bio',
      location: 'Earth',
    },
  };

  const parsed = UserProfileSchema.safeParse(invalidProfile);
  assert.equal(parsed.success, false, 'Invalid profile should fail validation');
});

test('Mock Provider: Enforces strict anti-hallucination for unknown achievements', async () => {
  const provider = new MockProvider();

  // Test question about an unverified organization
  const response = await provider.chat([
    { role: 'user', content: 'Did Farhan work as an astronaut at NASA in 2018?' },
  ]);

  assert.match(
    response.toLowerCase(),
    /do not have any record/i,
    'Agent must explicitly declare missing info rather than hallucinating'
  );
});

test('Mock Provider: Streams verified skills accurately', async () => {
  const provider = new MockProvider();

  const stream = await provider.streamChat([
    { role: 'user', content: 'What are your core technical skills?' },
  ]);

  const reader = stream.getReader();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += value;
  }

  assert.ok(text.includes('TypeScript'), 'Response must mention verified skills (TypeScript)');
  assert.ok(text.includes('AI & Agentic Systems'), 'Response must mention AI competencies');
});

test('Grounding Engine: Injects candidate records and strict negative constraints', () => {
  const prompt = buildSystemPrompt();

  assert.ok(
    prompt.includes('CRITICAL ANTI-HALLUCINATION & FACTUAL BOUNDARY RULES'),
    'System prompt must contain explicit anti-hallucination section'
  );
  assert.ok(
    prompt.includes('Farhan'),
    'System prompt must reference Farhan'
  );
  assert.ok(
    prompt.includes('I do not have this in Farhan\'s verified career records'),
    'System prompt must mandate exact transparency phrase for missing facts'
  );
});

test('Provider Factory: Successfully resolves mock and lists available providers', () => {
  const providers = getAvailableProviders();
  assert.ok(Array.isArray(providers), 'Providers must be an array');
  assert.ok(providers.some((p) => p.id === 'gemini'), 'Gemini provider must be registered');
  assert.ok(providers.some((p) => p.id === 'openai'), 'OpenAI provider must be registered');
  assert.ok(providers.some((p) => p.id === 'groq'), 'Groq provider must be registered');
  assert.ok(providers.some((p) => p.id === 'mock'), 'Mock provider must be registered');

  const mockInstance = createProvider('mock');
  assert.equal(mockInstance.id, 'mock');
});

test('Multi-API Failover: Falls back to mock provider gracefully when keys are missing', async () => {
  const { stream, providerUsed } = await streamChatWithFallback([
    { role: 'user', content: 'Hello Farhan AI' },
  ], {}, 'gemini');

  assert.ok(stream, 'Stream must be returned');
  assert.equal(providerUsed, 'mock', 'Provider should gracefully fallback to mock when gemini key is not set');
});
