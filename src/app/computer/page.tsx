'use client';

import React from 'react';
import { ComputerDashboard } from '@/components/ComputerDashboard';
import Link from 'next/link';

export default function ComputerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-main)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(10, 14, 23, 0.9)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/"
            style={{
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            ← Back to Auren AI OS
          </Link>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#fff' }}>
            Auren AI Computer Control Runtime
          </span>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ComputerDashboard />
      </main>
    </div>
  );
}
