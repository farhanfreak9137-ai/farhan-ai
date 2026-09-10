'use client';

import React from 'react';
import { SUGGESTED_PROMPTS } from '@/data/suggestedPrompts';
import { SparklesIcon } from './Icons';

interface PromptChipsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export function PromptChips({ onSelectPrompt, disabled }: PromptChipsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '1rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
        <SparklesIcon />
        <span>Suggested Career Prompts</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {SUGGESTED_PROMPTS.map((item, idx) => (
          <button
            key={idx}
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(24, 34, 56, 0.6)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'left',
            }}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
