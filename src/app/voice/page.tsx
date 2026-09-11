// src/app/voice/page.tsx
import React from 'react';
import { VoiceStudio } from '@/components/voice/VoiceStudio';
import Link from 'next/link';

export const metadata = {
  title: 'Voice Interface | Farhan AI',
  description: 'Hands-free voice assistant integration powered by Central Assistant',
};

export default function VoicePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f8fafc', padding: '1rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto 1rem auto' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#94a3b8',
            fontSize: '0.85rem',
            textDecoration: 'none',
            padding: '0.4rem 0.8rem',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          ← Back to Farhan AI Hub
        </Link>
      </div>
      <VoiceStudio />
    </div>
  );
}
