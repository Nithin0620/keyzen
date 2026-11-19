import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export function EmptyState({ title, description, action, icon: Icon }: EmptyStateProps): ReactNode {
  return (
    <Card className="text-center p-6">
      <CardHeader className="space-y-2">
        {Icon && (
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-peri/10 text-peri-2 border border-peri/20">
            <Icon className="size-5" />
          </div>
        )}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
