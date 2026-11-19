import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-mono font-medium transition-colors tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-peri text-white shadow-sm',
        secondary: 'border-line bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-transparent bg-warning text-warning-foreground',
        outline: 'border-line text-ink-2 bg-line/[0.08]',
        live: 'border-success/25 bg-success/10 text-success',
        up: 'border-success/20 bg-success/10 text-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  liveDot?: boolean;
}

export function Badge({ className, variant, liveDot = false, children, ...props }: BadgeProps): React.ReactNode {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {(liveDot || variant === 'live') && (
        <span className="size-1.5 rounded-full bg-success shadow-[0_0_8px_theme(colors.success.DEFAULT)] animate-pulse-live" />
      )}
      {children}
    </div>
  );
}
