// src/app/automation/page.tsx
import React from 'react';
import { AutomationDashboard } from '@/components/automation/AutomationDashboard';
import Link from 'next/link';

export const metadata = {
  title: 'Automation Engine | Auren AI',
  description: 'Persistent background automation and scheduled opportunity monitoring',
};

export default function AutomationPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f8fafc', padding: '1rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto 1rem auto' }}>
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
          ← Back to Auren AI Hub
        </Link>
      </div>
      <AutomationDashboard />
    </div>
  );
}
