import type { Metadata } from 'next';
import './globals.css';
import { FloatingVoicePill } from '@/components/voice/FloatingVoicePill';

export const metadata: Metadata = {
  title: 'Auren AI — Personal Operating System',
  description: 'Autonomous multi-agent desktop AI operating system and intelligent companion.',
  keywords: ['Auren AI', 'AI Desktop OS', 'Agent Fleet', 'Next.js', 'Voice Companion'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <FloatingVoicePill />
        {children}
      </body>
    </html>
  );
}
