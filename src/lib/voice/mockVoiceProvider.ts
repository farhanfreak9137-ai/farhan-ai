// src/lib/voice/mockVoiceProvider.ts
import {
  VoiceProvider,
  VoiceProviderState,
  TranscriptionRequest,
  TranscriptionResult,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
} from './types';

/**
 * Generates a valid minimal 44-byte WAV header containing 0.1s of silence in Base64.
 * This guarantees browser audio players receive a valid audio/wav container.
 */
function generateMockWavBase64(durationMs: number = 200): string {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byteRate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // blockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Remaining bytes are initialized to 0 (silent PCM data)
  return buffer.toString('base64');
}

export class MockVoiceProvider implements VoiceProvider {
  readonly id = 'mock_voice_provider';
  readonly name = 'Mock Offline Voice Provider';

  private queuedTranscripts: string[] = [];
  private defaultTranscript = 'Find remote Next.js opportunities';

  getState(): VoiceProviderState {
    return 'MOCK';
  }

  /**
   * Queue a transcript to be returned on the next transcribe() call.
   */
  queueTranscript(transcript: string): void {
    this.queuedTranscripts.push(transcript);
  }

  setDefaultTranscript(transcript: string): void {
    this.defaultTranscript = transcript;
  }

  clearQueue(): void {
    this.queuedTranscripts = [];
  }

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    if (!request.audio && !request.metadata?.text) {
      throw new Error('Audio data is required for transcription');
    }

    let transcript = this.queuedTranscripts.shift() || this.defaultTranscript;
    // If request contains test hint in metadata or base64 decoded string
    if (request.metadata?.transcriptHint) {
      transcript = String(request.metadata.transcriptHint);
    } else if (typeof request.audio === 'string' && request.audio.startsWith('text:')) {
      transcript = request.audio.replace('text:', '');
    }

    return {
      transcript,
      confidence: 0.98,
      provider: 'mock_voice',
      timestamp: new Date().toISOString(),
      duration: 2.1,
      language: request.language || 'en',
    };
  }

  async speak(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text is required for speech synthesis');
    }

    const estimatedDurationSec = Math.max(0.5, (request.text.split(/\s+/).length / 150) * 60);
    const audioData = generateMockWavBase64(Math.min(1000, Math.floor(estimatedDurationSec * 1000)));

    return {
      audioData,
      format: 'wav',
      duration: Math.round(estimatedDurationSec * 10) / 10,
      provider: 'mock_voice',
      timestamp: new Date().toISOString(),
    };
  }
}

export const mockVoiceProvider = new MockVoiceProvider();
