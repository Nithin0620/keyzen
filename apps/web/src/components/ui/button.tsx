'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-peri text-white shadow-peri-glow hover:bg-peri-hover hover:shadow-peri-glow-hover hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:-translate-y-0.5',
        outline:
          'border border-line bg-background/50 hover:bg-accent hover:text-accent-foreground backdrop-blur-md',
        ghost:
          'border border-white/20 bg-white/[0.03] text-foreground hover:bg-white/[0.1] hover:-translate-y-0.5',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-0.5',
        link: 'text-peri-2 underline-offset-4 hover:underline',
        white:
          'bg-white text-[#14163f] hover:bg-white/90 hover:-translate-y-0.5 shadow-sm font-semibold',
        dark:
          'bg-[#141a4d] border border-line text-white hover:bg-[#1c2363] hover:-translate-y-0.5',
        glass:
          'bg-[rgba(120,124,200,0.42)] border border-[rgba(210,210,255,0.2)] backdrop-blur-[10px] text-white hover:-translate-y-0.5',
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
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';
