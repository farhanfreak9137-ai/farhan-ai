// src/lib/voice/types.ts

export type VoiceRecordingState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'RESPONDING' | 'ERROR';

export type VoiceProviderState = 'REAL' | 'MOCK' | 'BROWSER' | 'UNAVAILABLE';

export interface TranscriptionRequest {
  /** Base64 audio string, Blob, or Buffer */
  audio: string | Buffer;
  language?: string;
  format?: 'wav' | 'webm' | 'mp3' | 'ogg';
  metadata?: Record<string, unknown>;
}

export interface TranscriptionResult {
  transcript: string;
  confidence?: number;
  provider: string;
  timestamp: string;
  duration?: number;
  language?: string;
}

export interface SpeechSynthesisRequest {
  text: string;
  language?: string;
  voice?: string;
  format?: 'wav' | 'mp3' | 'ogg';
}

export interface SpeechSynthesisResult {
  /** Base64 encoded audio string */
  audioData: string;
  format: string;
  duration?: number;
  provider: string;
  timestamp: string;
}

export interface VoiceProviderInfo {
  id: string;
  name: string;
  state: VoiceProviderState;
  hasSTT: boolean;
  hasTTS: boolean;
  details?: string;
}

export interface SpeechToTextProvider {
  id: string;
  name: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
  getState(): VoiceProviderState;
}

export interface TextToSpeechProvider {
  id: string;
  name: string;
  speak(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
  getState(): VoiceProviderState;
}

export interface VoiceProvider extends SpeechToTextProvider, TextToSpeechProvider {}

export interface VoiceCommandRequest {
  /** Base64 audio if speech input */
  audio?: string;
  /** Direct transcript if already transcribed in browser */
  transcript?: string;
  conversationId?: string;
  language?: string;
  provider?: any;
  context?: Record<string, unknown>;
}

export interface VoiceCommandResponse {
  transcript: string;
  responseText: string;
  responseAudio?: string;
  audioFormat?: string;
  providerUsed: string;
  approvalRequired?: boolean;
  approvalDetails?: {
    actionId?: string;
    title?: string;
    description?: string;
    payload?: unknown;
  };
  steps?: Array<{
    step: string;
    title: string;
    description: string;
  }>;
}
