'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-peri text-white shadow-peri-glow hover:bg-peri-hover hover:shadow-peri-glow-hover hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:-translate-y-0.5 active:translate-y-0',
        outline:
          'border border-line bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-md active:translate-y-0',
        ghost:
          'border border-line bg-line/[0.03] text-foreground hover:bg-line/[0.1] hover:-translate-y-0.5 active:translate-y-0',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-0.5 active:translate-y-0',
        link: 'text-peri-2 underline-offset-4 hover:underline',
        white:
          'bg-white text-navy hover:bg-white/90 hover:-translate-y-0.5 shadow-sm font-semibold active:translate-y-0',
        dark:
          'bg-violet-deep border border-line text-ink hover:bg-secondary hover:-translate-y-0.5 active:translate-y-0',
        glass:
          'glass-surface text-ink hover:-translate-y-0.5 active:translate-y-0',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }), loading && 'pointer-events-none opacity-80 cursor-wait')}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    const Comp = 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), loading && 'cursor-wait')}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading ? 'true' : undefined}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin shrink-0" />}
        {loading && loadingText ? loadingText : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
