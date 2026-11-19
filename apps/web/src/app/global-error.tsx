'use client';

import type { ReactNode } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import './globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }): ReactNode {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
          <ErrorState
            description="The application could not be loaded. Try again or contact support if the problem continues."
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}
