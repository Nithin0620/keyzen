'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CopyButton({ value, className }: { value: string; className?: string }): ReactNode {
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'Copied' : 'Copy code'}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg border border-line bg-white/[0.04] text-ink-2 transition hover:border-peri/40 hover:text-ink',
        copied && 'border-peri/50 text-peri-2',
        className
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </button>
  );
}
