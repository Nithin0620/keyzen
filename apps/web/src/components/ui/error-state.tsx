'use client';

import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';

export interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', description, onRetry }: ErrorStateProps): ReactNode {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="mb-2 size-5" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{description}</span>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
