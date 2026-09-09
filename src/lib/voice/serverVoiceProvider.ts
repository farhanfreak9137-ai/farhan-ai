// src/lib/voice/serverVoiceProvider.ts
import {
  VoiceProvider,
  VoiceProviderState,
  TranscriptionRequest,
  TranscriptionResult,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
} from './types';
import { mockVoiceProvider } from './mockVoiceProvider';

/**
 * Server-side Voice Provider.
 * Safely executes STT and TTS on the server without exposing API keys or secrets to the browser.
 * Falls back to deterministic mock provider if external API keys (e.g. OPENAI_API_KEY) are not configured.
 */
export class ServerVoiceProvider implements VoiceProvider {
  readonly id = 'server_voice_provider';
  readonly name = 'Server Voice Provider';

  private apiKey?: string;
  private openAiBaseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.SPEECH_API_KEY;
    this.openAiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  }

  getState(): VoiceProviderState {
    return this.apiKey ? 'REAL' : 'MOCK';
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    // If no real API key configured, use deterministic provider
    if (!this.apiKey) {
      return mockVoiceProvider.transcribe(request);
    }

    try {
      // If audio is provided as Buffer or base64, create form data
      let audioBuffer: Buffer;
      if (Buffer.isBuffer(request.audio)) {
        audioBuffer = request.audio;
      } else if (typeof request.audio === 'string') {
        const cleanBase64 = request.audio.replace(/^data:audio\/\w+;base64,/, '');
        audioBuffer = Buffer.from(cleanBase64, 'base64');
      } else {
        throw new Error('Invalid audio format provided for transcription');
      }

      const boundary = '----VoiceTranscriptionBoundary' + Date.now();
      const filename = `audio.${request.format || 'wav'}`;
      const mimeType = request.format === 'mp3' ? 'audio/mpeg' : request.format === 'webm' ? 'audio/webm' : 'audio/wav';

      // Build multipart request for OpenAI Whisper API
      const parts: Buffer[] = [];
      
      // model field
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));
      
      // language field if given
      if (request.language) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${request.language}\r\n`));
      }

      // file field
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
      parts.push(audioBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const payload = Buffer.concat(parts);

      const response = await fetch(`${this.openAiBaseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[ServerVoiceProvider] STT API returned ${response.status}: ${errorText}. Falling back to mock.`);
        return mockVoiceProvider.transcribe(request);
      }

      const data = await response.json();
      return {
        transcript: data.text || '',
        confidence: 0.95,
        provider: 'openai_whisper',
        timestamp: new Date().toISOString(),
        language: request.language || 'en',
      };
    } catch (err: any) {
      console.warn(`[ServerVoiceProvider] Transcription error: ${err.message}. Falling back to mock.`);
      return mockVoiceProvider.transcribe(request);
    }
  }

  async speak(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    if (!this.apiKey) {
      return mockVoiceProvider.speak(request);
    }

    try {
      const response = await fetch(`${this.openAiBaseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: request.text,
          voice: request.voice || 'alloy',
          response_format: request.format || 'mp3',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[ServerVoiceProvider] TTS API returned ${response.status}: ${errorText}. Falling back to mock.`);
        return mockVoiceProvider.speak(request);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');

      return {
        audioData: base64Audio,
        format: request.format || 'mp3',
        provider: 'openai_tts',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn(`[ServerVoiceProvider] Speech synthesis error: ${err.message}. Falling back to mock.`);
      return mockVoiceProvider.speak(request);
    }
  }
}

export const serverVoiceProvider = new ServerVoiceProvider();
