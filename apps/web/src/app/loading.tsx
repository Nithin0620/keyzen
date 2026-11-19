import type { ReactNode } from 'react';
import { LoadingState } from '@/components/ui/loading-state';

export default function Loading(): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
      <LoadingState rows={5} />
    </main>
  );
}
