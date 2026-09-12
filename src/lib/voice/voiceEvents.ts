// src/lib/voice/voiceEvents.ts

export interface VoiceEvent {
  id: string;
  timestamp: number;
  transcript: string;
  responseText: string;
  providerUsed?: string;
  steps?: Array<{
    step: string;
    title: string;
    description: string;
  }>;
  approvalRequired?: boolean;
  approvalDetails?: any;
}

// In-memory circular buffer of recent voice interactions (persists across API requests in Node process)
const MAX_EVENTS = 50;
const voiceEventBuffer: VoiceEvent[] = [];

export function recordVoiceEvent(event: Omit<VoiceEvent, 'id' | 'timestamp'>): VoiceEvent {
  const fullEvent: VoiceEvent = {
    ...event,
    id: `ve_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  voiceEventBuffer.push(fullEvent);
  if (voiceEventBuffer.length > MAX_EVENTS) {
    voiceEventBuffer.shift();
  }

  return fullEvent;
}

export function getVoiceEvents(sinceTimestamp: number = 0): VoiceEvent[] {
  return voiceEventBuffer.filter((e) => e.timestamp > sinceTimestamp);
}
