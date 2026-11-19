import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      default: 'border-border bg-card text-card-foreground',
      success: 'border-success/30 bg-success/10 text-foreground',
      warning: 'border-warning/30 bg-warning/10 text-foreground',
      destructive: 'border-destructive/30 bg-destructive/10 text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps): React.ReactNode {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>): React.ReactNode {
  return <h5 className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.ReactNode {
  return <div className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
