'use client';

import React, { useEffect, useState } from 'react';

interface HudState {
  text: string;
  color: string;
  border: string;
  alpha: number;
}

export const FloatingVoicePill: React.FC = () => {
  const [hud, setHud] = useState<HudState>({
    text: 'Auren: Standby',
    color: '#64748B',
    border: '#1E293B',
    alpha: 0.88,
  });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/voice/status');
        if (res.ok) {
          const data = await res.json();
          if (data?.hudState && mounted) {
            setHud(data.hudState);
          }
        }
      } catch {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!visible) return null;

  const isListening = hud.text.toLowerCase().includes('listening');
  const isSpeaking = hud.text.toLowerCase().includes('auren:');
  const isHeard = hud.text.toLowerCase().includes('heard');

  return (
    <div
      id="auren-top-left-floating-pill"
      className="fixed top-4 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-full border shadow-2xl backdrop-blur-md transition-all duration-300 select-none group"
      style={{
        backgroundColor: 'rgba(7, 10, 18, 0.88)',
        borderColor: hud.border || 'rgba(30, 41, 59, 0.8)',
        boxShadow: isListening
          ? '0 0 18px rgba(16, 185, 129, 0.4)'
          : isHeard
          ? '0 0 18px rgba(168, 85, 247, 0.4)'
          : '0 4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {/* Animated Status Pulse */}
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {isListening && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: hud.color }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2 transition-colors duration-300"
          style={{ backgroundColor: hud.color }}
        />
      </span>

      {/* Dynamic Icon SVG */}
      {isSpeaking ? (
        <svg className="w-3.5 h-3.5 text-emerald-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      ) : isListening ? (
        <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" x2="12" y1="19" y2="22"></line>
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
        </svg>
      )}

      {/* Status Label */}
      <span
        className="text-xs font-semibold tracking-wide transition-colors duration-200"
        style={{ color: hud.color === '#64748B' ? '#94A3B8' : '#F8FAFC' }}
      >
        {hud.text}
      </span>

      {/* Mini Dismiss */}
      <button
        onClick={() => setVisible(false)}
        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-[10px] text-slate-400 hover:text-white ml-1 transition-opacity"
        title="Hide pill (refresh page to restore)"
      >
        ✕
      </button>
    </div>
  );
};
