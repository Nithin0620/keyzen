'use client';

import type { ReactNode } from 'react';
import { ErrorState } from '@/components/ui/error-state';

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
      <ErrorState
        description="The dashboard could not be loaded. Try again or contact support if the problem continues."
        onRetry={reset}
      />
    </main>
  );
}
