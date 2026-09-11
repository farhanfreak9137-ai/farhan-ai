import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Farhan AI — Personal Career Agent',
  description: 'Personalized AI Career Operating System grounded in Farhan\'s verified skills, experience, and aspirations.',
  keywords: ['AI Career Agent', 'Career Operating System', 'Farhan AI', 'Next.js', 'AI Assistant'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
