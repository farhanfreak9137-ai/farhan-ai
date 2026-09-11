'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

/**
 * Synthesizes an iconic, futuristic 2-tone Jarvis activation chime using Web Audio API.
 * Works 100% offline with zero external audio assets.
 */
export function playJarvisChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1: High D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Tone 2: Futuristic Harmonic A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.18, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.32);
  } catch (err) {
    console.warn('[Jarvis] AudioContext chime warning:', err);
  }
}

export interface UseVoiceInputOptions {
  enableWakeWord?: boolean;
  onWakeWord?: (wakeWord: string) => void;
  hotkeyEnabled?: boolean;
}

/**
 * Custom hook for browser-native speech-to-text input with:
 * 1. Wake word detection ("Jarvis", "Hey Jarvis", "Hey Farhan", "Farhan")
 * 2. In-app hotkeys (Alt+J, Ctrl+Space)
 * 3. Audio feedback chimes
 */
export function useVoiceInput(
  onTranscript: (text: string) => void,
  options: UseVoiceInputOptions = {}
) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [wakeWordMode, setWakeWordMode] = useState(options.enableWakeWord ?? false);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const wakeWordModeRef = useRef(wakeWordMode);
  const wakeWordActiveRef = useRef(wakeWordActive);

  wakeWordModeRef.current = wakeWordMode;
  wakeWordActiveRef.current = wakeWordActive;

  const handleStart = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
    } catch (err) {
      // Recognition may already be running
      setIsListening(true);
      isListeningRef.current = true;
    }
  }, []);

  const handleStop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
      setWakeWordActive(false);
    } catch (err) {
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (isListeningRef.current) {
      handleStop();
    } else {
      playJarvisChime();
      handleStart();
    }
  }, [handleStart, handleStop]);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = wakeWordMode;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const result = event.results[current];
          const transcript = result[0].transcript.trim();

          if (wakeWordModeRef.current) {
            // Wake word regex pattern matching: "Jarvis", "Hey Jarvis", "Farhan", "Hey Farhan"
            const wakeMatch = transcript.match(/^(?:hey\s+)?(?:jarvis|farhan)[,\s]*(.*)$/i);
            
            if (wakeMatch) {
              const command = wakeMatch[1].trim();
              if (!wakeWordActiveRef.current) {
                setWakeWordActive(true);
                playJarvisChime();
                if (optionsRef.current.onWakeWord) optionsRef.current.onWakeWord('Jarvis');
              }

              if (result.isFinal && command.length > 1) {
                onTranscriptRef.current(command);
                setWakeWordActive(false);
              }
              return;
            }

            // If wake word was previously triggered and user is now speaking the command
            if (wakeWordActiveRef.current && result.isFinal && transcript.length > 1) {
              onTranscriptRef.current(transcript);
              setWakeWordActive(false);
              return;
            }
          }

          if (result.isFinal) {
            onTranscriptRef.current(transcript);
            if (!wakeWordModeRef.current) {
              setIsListening(false);
              isListeningRef.current = false;
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
            console.warn('[Jarvis Voice] Speech recognition warning:', event.error);
          }
          if (!wakeWordModeRef.current) {
            setIsListening(false);
            isListeningRef.current = false;
          }
        };

        recognition.onend = () => {
          // If in continuous wake word mode, silently auto-restart
          if (wakeWordModeRef.current && isListeningRef.current) {
            try {
              recognition.start();
            } catch {
              // Retry on delay if locked
              setTimeout(() => {
                if (wakeWordModeRef.current && isListeningRef.current) {
                  try { recognition.start(); } catch {}
                }
              }, 300);
            }
          } else {
            setIsListening(false);
            isListeningRef.current = false;
          }
        };

        recognitionRef.current = recognition;

        return () => {
          try {
            recognition.abort();
          } catch {}
        };
      }
    }
  }, [wakeWordMode]);

  // Global in-app hotkey listener: Alt+J or Ctrl+Space
  useEffect(() => {
    if (typeof window === 'undefined' || options.hotkeyEnabled === false) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger hotkey if user is actively typing inside an input or textarea
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

      const isAltJ = e.altKey && (e.key === 'j' || e.key === 'J');
      const isCtrlSpace = e.ctrlKey && e.code === 'Space';

      if (isAltJ || (isCtrlSpace && !isInput)) {
        e.preventDefault();
        handleToggle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleToggle, options.hotkeyEnabled]);

  return {
    isListening,
    isSupported,
    wakeWordMode,
    wakeWordActive,
    setWakeWordMode,
    startListening: handleStart,
    stopListening: handleStop,
    toggleListening: handleToggle,
    playJarvisChime,
  };
}

/**
 * Speaks text using the browser's native text-to-speech engine.
 */
export function speakText(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Stop any currently playing audio
  window.speechSynthesis.cancel();

  // Strip markdown formatting for cleaner speech
  const cleanText = text
    .replace(/[#*`_~>[\]]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  utterance.lang = 'en-US';

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Stops any active speech synthesis output.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
