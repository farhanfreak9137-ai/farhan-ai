'use client';

import React, { useEffect, useState, useRef } from 'react';

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
  const [position, setPosition] = useState({ x: 20, y: 70 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 200, e.clientX - dragOffset.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 50, e.clientY - dragOffset.current.y)),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!visible) return null;

  const isListening = hud.text.toLowerCase().includes('listening');
  const isSpeaking = hud.text.toLowerCase().includes('auren:');
  const isHeard = hud.text.toLowerCase().includes('heard');

  return (
    <div
      id="auren-top-left-floating-pill"
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 99999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        borderRadius: '9999px',
        backgroundColor: 'rgba(7, 10, 18, 0.90)',
        border: `1px solid ${hud.border || '#1E293B'}`,
        boxShadow: isListening
          ? '0 0 16px rgba(16, 185, 129, 0.45)'
          : isHeard
          ? '0 0 16px rgba(168, 85, 247, 0.45)'
          : '0 4px 16px rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        userSelect: 'none',
        cursor: 'grab',
        transition: isDragging.current ? 'none' : 'box-shadow 0.25s ease, border-color 0.25s ease',
        maxWidth: '360px',
        height: '34px',
        boxSizing: 'border-box',
        lineHeight: 1,
      }}
      title="Click and drag to reposition"
    >
      {/* Status Dot */}
      <span
        style={{
          width: '8px',
          height: '8px',
          minWidth: '8px',
          minHeight: '8px',
          borderRadius: '50%',
          backgroundColor: hud.color || '#64748B',
          boxShadow: isListening ? `0 0 8px ${hud.color}` : 'none',
          display: 'inline-block',
          transition: 'background-color 0.25s ease',
        }}
      />

      {/* Mini Icon */}
      {isSpeaking ? (
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10B981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: '13px', height: '13px', minWidth: '13px', minHeight: '13px', display: 'inline-block', flexShrink: 0 }}
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      ) : isListening ? (
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10B981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: '13px', height: '13px', minWidth: '13px', minHeight: '13px', display: 'inline-block', flexShrink: 0 }}
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" x2="12" y1="19" y2="22"></line>
        </svg>
      ) : (
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: '13px', height: '13px', minWidth: '13px', minHeight: '13px', display: 'inline-block', flexShrink: 0 }}
        >
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
        </svg>
      )}

      {/* Label Text */}
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.01em',
          color: hud.color === '#64748B' ? '#94A3B8' : '#F8FAFC',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: "'Inter', -apple-system, sans-serif",
        }}
      >
        {hud.text}
      </span>

      {/* Mini Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setVisible(false);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#64748B',
          cursor: 'pointer',
          fontSize: '11px',
          padding: '0 2px',
          marginLeft: '4px',
          lineHeight: 1,
        }}
        title="Hide pill (refresh to restore)"
      >
        ✕
      </button>
    </div>
  );
};
