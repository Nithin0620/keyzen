import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({
  className,
  glass = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { glass?: boolean }): React.ReactNode {
  return (
    <div
      className={cn(
        'rounded-xl border border-line text-card-foreground shadow-sm transition-all duration-300',
        glass ? 'glass-surface' : 'bg-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>): React.ReactNode {
  return <h3 className={cn('text-lg font-semibold leading-none tracking-tight text-ink', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>): React.ReactNode {
  return <p className={cn('text-sm text-ink-2', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}
