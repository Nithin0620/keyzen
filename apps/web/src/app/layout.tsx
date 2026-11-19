import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter_Tight, Fira_Code, Instrument_Serif } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400'],
  style: ['italic'],
});

export const metadata: Metadata = {
  title: 'Aegis — Secret Ops & Key Orchestration Studio',
  description: 'The independent studio for curating, securing, and orchestrating programmatic secrets.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interTight.variable} ${firaCode.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-peri/30 selection:text-ink">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
