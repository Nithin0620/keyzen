import type { ReactNode } from 'react';
import { Card, CardContent } from './card';
import { Skeleton } from './skeleton';

export function LoadingState({ rows = 3 }: { rows?: number }): ReactNode {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <CardContent className="grid gap-3 pt-6">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
