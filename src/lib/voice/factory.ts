// src/lib/voice/factory.ts
import { VoiceProvider, VoiceProviderInfo } from './types';
import { mockVoiceProvider, MockVoiceProvider } from './mockVoiceProvider';
import { serverVoiceProvider, ServerVoiceProvider } from './serverVoiceProvider';

let activeProvider: VoiceProvider = serverVoiceProvider;

export function getVoiceProvider(): VoiceProvider {
  return activeProvider;
}

export function setVoiceProvider(provider: VoiceProvider): void {
  activeProvider = provider;
}

export function resetVoiceProvider(): void {
  activeProvider = serverVoiceProvider;
}

export function getVoiceProviderStatus(): VoiceProviderInfo {
  const provider = getVoiceProvider();
  const state = provider.getState();

  return {
    id: provider.id,
    name: provider.name,
    state,
    hasSTT: true,
    hasTTS: true,
    details:
      state === 'REAL'
        ? 'Active server provider configured with external credentials.'
        : 'Running in deterministic offline mock mode (no external keys required).',
  };
}
