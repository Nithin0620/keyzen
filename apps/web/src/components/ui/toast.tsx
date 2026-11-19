'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'error';

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastEntry extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastVariants: Record<ToastVariant, string> = {
  default: 'border-border bg-background text-foreground',
  success: 'border-success/40 bg-success/10 text-foreground',
  error: 'border-destructive/40 bg-destructive/10 text-foreground',
};

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    setToasts((current) => [...current, { ...input, id: Date.now() + current.length }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {toasts.map((entry) => (
          <ToastPrimitive.Root
            key={entry.id}
            open
            onOpenChange={(open) => {
              if (!open) dismiss(entry.id);
            }}
            className={cn(
              'grid grid-cols-[1fr_auto] items-start gap-3 rounded-lg border p-4 shadow-lg',
              toastVariants[entry.variant ?? 'default'],
            )}
          >
            <div className="grid gap-1">
              <ToastPrimitive.Title className="text-sm font-semibold">{entry.title}</ToastPrimitive.Title>
              {entry.description ? (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {entry.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close className="rounded-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Dismiss notification">
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
