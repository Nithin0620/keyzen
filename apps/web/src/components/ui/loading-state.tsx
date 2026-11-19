import type { ReactNode } from 'react';
import { Card, CardContent } from './card';
import { Skeleton } from './skeleton';

export function LoadingState({
  rows = 3,
  message,
}: {
  rows?: number;
  message?: string;
}): ReactNode {
  return (
    <Card aria-busy="true" aria-label={message ?? 'Loading'}>
      <CardContent className="grid gap-3 pt-6">
        {message && <p className="font-mono text-xs text-ink-3">{message}</p>}
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
