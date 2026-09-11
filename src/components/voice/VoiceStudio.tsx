'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceRecordingState, VoiceProviderInfo, VoiceCommandResponse } from '@/lib/voice/types';
import { MicIcon, VolumeIcon, StopIcon, SparklesIcon, ShieldCheckIcon } from '@/components/Icons';
import { useVoiceInput, speakText, stopSpeaking } from '@/lib/voice/speech';

interface MessageHistoryItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioData?: string;
  approvalRequired?: boolean;
  approvalDetails?: any;
}

export function VoiceStudio() {
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>('IDLE');
  const [transcript, setTranscript] = useState<string>('');
  const [providerInfo, setProviderInfo] = useState<VoiceProviderInfo | null>(null);
  const [history, setHistory] = useState<MessageHistoryItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch Voice Provider status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/voice/status');
      if (res.ok) {
        const data = await res.json();
        setProviderInfo(data);
      }
    } catch (err) {
      console.warn('Failed to load voice status:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const [wakeStatus, setWakeStatus] = useState<string | null>(null);
  const querySeqRef = useRef(0);

  const [latestResponse, setLatestResponse] = useState<{
    text: string;
    toolCalled?: string;
    approvalRequired?: boolean;
    approvalDetails?: any;
    status: 'thinking' | 'ready';
    providerUsed?: string;
  } | null>(null);

  // Submit voice or text command to /api/voice/command
  const submitVoiceQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const currentSeq = ++querySeqRef.current;
    setTranscript(queryText);
    setRecordingState('PROCESSING');
    setErrorMessage(null);
    setLatestResponse({
      text: 'Consulting Auren agents & executing tools...',
      status: 'thinking',
    });

    const userMessage: MessageHistoryItem = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory((prev) => [...prev, userMessage]);

    try {
      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: queryText }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Voice command failed to process');
      }

      const data: VoiceCommandResponse = await res.json();

      // Drop stale response if another query has been issued in the meantime
      if (currentSeq !== querySeqRef.current) {
        console.log(`[VoiceStudio] Dropping stale response #${currentSeq}, active is #${querySeqRef.current}`);
        return;
      }

      const toolCalled = (data as any).steps?.find(
        (s: any) => s.title?.includes('Invoking') || s.step === 'tool_execution'
      )?.title;

      setLatestResponse({
        text: data.responseText,
        toolCalled: toolCalled || (data.approvalRequired ? 'Authorization Required' : undefined),
        approvalRequired: data.approvalRequired,
        approvalDetails: data.approvalDetails,
        status: 'ready',
        providerUsed: data.providerUsed,
      });

      const assistantMessage: MessageHistoryItem = {
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: data.responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        audioData: data.responseAudio,
        approvalRequired: data.approvalRequired,
        approvalDetails: data.approvalDetails,
      };

      setHistory((prev) => [...prev, assistantMessage]);
      setRecordingState('RESPONDING');

      // Speech audio: use real MP3 if provided by external TTS, otherwise use browser SpeechSynthesis
      if (data.responseAudio && data.audioFormat === 'mp3') {
        playBase64Audio(data.responseAudio, data.audioFormat || 'mp3');
      } else {
        speakText(data.responseText, () => {
          setIsPlayingAudio(false);
          setRecordingState('IDLE');
          if (wakeWordMode) {
            startListening();
          }
        });
        setIsPlayingAudio(true);
      }
    } catch (err: any) {
      if (currentSeq !== querySeqRef.current) return;
      console.error('Voice processing error:', err);
      setErrorMessage(err.message || 'An error occurred while processing your voice command.');
      setRecordingState('ERROR');
      setLatestResponse(null);
    }
  };

  const submitVoiceQueryRef = useRef(submitVoiceQuery);
  submitVoiceQueryRef.current = submitVoiceQuery;

  // Handle final speech transcript from the browser recognition hook
  const handleFinalSpeechTranscript = useCallback(async (spokenText: string) => {
    if (!spokenText.trim()) return;
    await submitVoiceQueryRef.current(spokenText);
  }, []);

  const {
    isListening,
    isSupported,
    wakeWordMode,
    wakeWordActive,
    setWakeWordMode,
    startListening,
    stopListening,
    toggleListening,
    playJarvisChime,
  } = useVoiceInput(handleFinalSpeechTranscript, {
    enableWakeWord: false,
    hotkeyEnabled: true,
    onWakeWord: (name) => {
      setWakeStatus(`⚡ ${name} Activated — Listening for command...`);
      setTimeout(() => setWakeStatus(null), 4000);
    },
  });

  // Autostart voice listening and/or wake word mode if URL query params are present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const shouldWakeWord = params.get('wakeword') === 'true' || params.get('wake') === 'true';
      const shouldAutostart = params.get('autostart') === 'true' || params.get('voice') === 'true';

      if (shouldWakeWord) {
        setWakeWordMode(true);
        startListening();
        setWakeStatus('⚡ Auren Mode Active — Say "Auren" or "Hey Auren"');
        setTimeout(() => setWakeStatus(null), 5000);
      } else if (shouldAutostart) {
        const timer = setTimeout(() => {
          playJarvisChime();
          startListening();
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [startListening, playJarvisChime, setWakeWordMode]);

  // Synchronize recording state
  useEffect(() => {
    if (isListening) {
      setRecordingState('LISTENING');
    } else if (recordingState === 'LISTENING') {
      setRecordingState('IDLE');
    }
  }, [isListening]);

  const playBase64Audio = (base64Data: string, format: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const mime = format === 'mp3' ? 'audio/mpeg' : 'audio/wav';
      const audioUrl = `data:${mime};base64,${base64Data}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPlayingAudio(true);
      audio.onended = () => {
        setIsPlayingAudio(false);
        setRecordingState('IDLE');
      };
      audio.onerror = () => {
        setIsPlayingAudio(false);
        setRecordingState('IDLE');
      };

      audio.play().catch((playErr) => {
        console.warn('Audio play failed, falling back to speech synthesis:', playErr);
        speakText(history[history.length - 1]?.content || '', () => {
          setIsPlayingAudio(false);
          setRecordingState('IDLE');
        });
      });
    } catch (err) {
      console.warn('Error playing base64 audio:', err);
      setIsPlayingAudio(false);
      setRecordingState('IDLE');
    }
  };

  const handleStopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopSpeaking();
    setIsPlayingAudio(false);
    if (recordingState === 'RESPONDING') {
      setRecordingState('IDLE');
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Status Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem 1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            <MicIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
              Auren Voice Studio
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Hands-free conversational assistant powered by Auren
            </p>
          </div>
        </div>

        {/* Provider Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.85rem',
              borderRadius: '999px',
              background: providerInfo?.state === 'REAL' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              border: `1px solid ${providerInfo?.state === 'REAL' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: providerInfo?.state === 'REAL' ? '#22c55e' : '#818cf8',
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: providerInfo?.state === 'REAL' ? '#4ade80' : '#a5b4fc' }}>
              {providerInfo?.name || 'Voice Provider'} ({providerInfo?.state || 'INIT'})
            </span>
          </div>
        </div>
      </div>

      {/* Main Interaction Stage */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '20px',
          padding: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow effect when active */}
        {recordingState === 'LISTENING' && (
          <div
            style={{
              position: 'absolute',
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(244, 63, 94, 0.25) 0%, transparent 70%)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }}
          />
        )}
        {recordingState === 'RESPONDING' && (
          <div
            style={{
              position: 'absolute',
              width: '240px',
              height: '240px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Jarvis Wake Word Activation Alert */}
        {wakeStatus && (
          <div
            className="animate-fade-in"
            style={{
              background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              borderRadius: '999px',
              padding: '6px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#e0e7ff',
              boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)',
            }}
          >
            {wakeStatus}
          </div>
        )}

        {/* State Indicator */}
        <div
          style={{
            fontSize: '0.85rem',
            letterSpacing: '0.08em',
            fontWeight: 700,
            textTransform: 'uppercase',
            color:
              recordingState === 'LISTENING'
                ? '#f43f5e'
                : recordingState === 'PROCESSING'
                ? '#eab308'
                : recordingState === 'RESPONDING'
                ? '#818cf8'
                : recordingState === 'ERROR'
                ? '#ef4444'
                : '#64748b',
          }}
        >
          {recordingState === 'LISTENING'
            ? '● LISTENING (Speak now...)'
            : recordingState === 'PROCESSING'
            ? '⚙ PROCESSING COMMAND...'
            : recordingState === 'RESPONDING'
            ? '▶ SPEAKING RESPONSE'
            : recordingState === 'ERROR'
            ? '⚠ ATTENTION REQUIRED'
            : wakeWordMode
            ? '⚡ AUREN WAKE MODE ACTIVE (Say "Auren..." or "Hey Auren...")'
            : 'IDLE — READY'}
        </div>

        {/* Big Interactive Mic Button */}
        <button
          onClick={() => {
            if (recordingState === 'RESPONDING' || isPlayingAudio) {
              handleStopSpeaking();
            } else {
              toggleListening();
            }
          }}
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            background:
              recordingState === 'LISTENING'
                ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
                : recordingState === 'PROCESSING'
                ? 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)'
                : recordingState === 'RESPONDING'
                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            boxShadow:
              recordingState === 'LISTENING'
                ? '0 0 35px rgba(244, 63, 94, 0.6)'
                : recordingState === 'RESPONDING'
                ? '0 0 30px rgba(99, 102, 241, 0.5)'
                : '0 8px 20px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            transition: 'all 0.25s ease',
            transform: recordingState === 'LISTENING' ? 'scale(1.08)' : 'scale(1)',
          }}
          title={recordingState === 'LISTENING' ? 'Stop Listening' : 'Start Speaking'}
        >
          {recordingState === 'RESPONDING' ? (
            <StopIcon className="w-8 h-8" />
          ) : (
            <MicIcon className="w-8 h-8 text-white" isListening={recordingState === 'LISTENING'} />
          )}
        </button>

        {/* Playback Controls & Stop Button */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isPlayingAudio && (
            <button
              onClick={handleStopSpeaking}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <StopIcon className="w-4 h-4" />
              Stop Speaking
            </button>
          )}

          {!isSupported && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              (Native browser STT unavailable; server voice audio processing active)
            </div>
          )}
        </div>

        {/* Auren Wake Word & Hotkey Control Center */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            margin: '0.25rem 0',
            width: '100%',
            maxWidth: '680px',
          }}
        >
          {/* Wake Word Toggle */}
          <button
            onClick={() => {
              const next = !wakeWordMode;
              setWakeWordMode(next);
              if (next) {
                playJarvisChime();
                startListening();
                setWakeStatus('⚡ Auren Mode Active — Say "Auren" or "Hey Auren" followed by your command');
                setTimeout(() => setWakeStatus(null), 5000);
              } else {
                stopListening();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '999px',
              background: wakeWordMode
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(168, 85, 247, 0.35) 100%)'
                : 'rgba(30, 41, 59, 0.5)',
              border: `1px solid ${wakeWordMode ? 'rgba(168, 85, 247, 0.6)' : 'rgba(255, 255, 255, 0.12)'}`,
              color: wakeWordMode ? '#c7d2fe' : '#94a3b8',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: wakeWordMode ? '0 0 20px rgba(168, 85, 247, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{wakeWordMode ? '⚡' : '🎙️'}</span>
            <span>Auren Hands-Free Wake Word: <strong style={{ color: wakeWordMode ? '#4ade80' : '#94a3b8' }}>{wakeWordMode ? 'ACTIVE' : 'OFF'}</strong></span>
          </button>

          {/* Hotkey Badges */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
              title="Global Windows Shortcut: Press anywhere in Windows to summon Auren"
            >
              ⌨️ Windows: <kbd style={{ color: '#60a5fa', fontWeight: 700 }}>Ctrl + Alt + J</kbd>
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '0.35rem 0.7rem',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
              title="In-App Shortcut: Toggle microphone instantly"
            >
              App: <kbd style={{ color: '#a78bfa', fontWeight: 700 }}>Alt + J</kbd> or <kbd style={{ color: '#a78bfa', fontWeight: 700 }}>Ctrl + Space</kbd>
            </span>
          </div>
        </div>

        {/* Live / Last Transcript */}
        {transcript && (
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '0.85rem 1.25rem',
              fontSize: '0.95rem',
              color: '#e2e8f0',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
              Detected Speech
            </span>
            &ldquo;{transcript}&rdquo;
          </div>
        )}

        {/* Prominent Live Jarvis Response Card */}
        {latestResponse && (
          <div
            className="animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '650px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '14px',
              padding: '1rem 1.25rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 15px rgba(56, 189, 248, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🤖</span>
                <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                  JARVIS
                </span>
                {latestResponse.status === 'thinking' && (
                  <span style={{ fontSize: '0.75rem', color: '#eab308', fontStyle: 'italic' }}>
                    (Thinking...)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {latestResponse.providerUsed === 'local_fastpath' && (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid #10b981',
                      color: '#34d399',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      boxShadow: '0 0 10px rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    ⚡ 0 Tokens • Offline Fast-Path
                  </span>
                )}
                {latestResponse.toolCalled && (
                  <span
                    style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#4ade80',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}
                  >
                    ⚡ {latestResponse.toolCalled}
                  </span>
                )}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.98rem', color: '#f8fafc', lineHeight: 1.55 }}>
              {latestResponse.text}
            </p>

            {latestResponse.approvalRequired && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.25rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  color: '#facc15',
                  fontSize: '0.82rem',
                }}
              >
                <ShieldCheckIcon className="w-4 h-4" />
                <span>Action pending authorization. Say &ldquo;Approve&rdquo; to execute.</span>
              </div>
            )}
          </div>
        )}

        {/* Text fallback input for testing or quiet environments */}
        <div style={{ width: '100%', maxWidth: '650px', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Or type a command (e.g., 'Find remote React jobs' or 'Approve')..."
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typedInput.trim()) {
                submitVoiceQuery(typedInput);
                setTypedInput('');
              }
            }}
            style={{
              flex: 1,
              padding: '0.7rem 1rem',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              if (typedInput.trim()) {
                submitVoiceQuery(typedInput);
                setTypedInput('');
              }
            }}
            style={{
              padding: '0.7rem 1.2rem',
              borderRadius: '10px',
              background: '#6366f1',
              border: 'none',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: '#fca5a5',
              fontSize: '0.85rem',
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      {/* Conversation History */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
            Voice Session History ({history.length})
          </h2>
          {history.length > 0 && (
            <button
              onClick={() => setHistory([])}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            No voice interactions recorded yet in this session. Click the microphone to start speaking.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {history.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: msg.role === 'user' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.8)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  padding: '0.85rem 1.15rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: msg.role === 'user' ? '#a5b4fc' : '#38bdf8' }}>
                    {msg.role === 'user' ? 'User' : 'Farhan AI Assistant'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{msg.timestamp}</span>
                </div>

                <p style={{ margin: 0, fontSize: '0.92rem', color: '#f8fafc', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {msg.content}
                </p>

                {msg.approvalRequired && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.4rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      color: '#facc15',
                      fontSize: '0.78rem',
                    }}
                  >
                    <ShieldCheckIcon className="w-4 h-4" />
                    Human approval required before execution. Say &ldquo;Approve&rdquo; or confirm in Computer Dashboard.
                  </div>
                )}

                {msg.audioData && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <button
                      onClick={() => playBase64Audio(msg.audioData!, 'wav')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        color: '#cbd5e1',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      <VolumeIcon className="w-3.5 h-3.5" /> Replay Audio
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
