import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aegis — Secret Ops & Key Orchestration Studio',
  description: 'The independent studio for curating, securing, and orchestrating programmatic secrets.',
  icons: { icon: 'data:,' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="dark"
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-peri/30 selection:text-ink">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
