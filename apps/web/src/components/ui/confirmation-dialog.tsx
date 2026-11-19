'use client';

import { useId, useState, type ReactNode } from 'react';
import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Input } from './input';
import { Label } from './label';

export interface ConfirmationDialogProps {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  confirmationText?: string;
  requiredConfirmation?: string;
  confirmationLabel?: string;
  destructive?: boolean;
  onConfirm: (confirmation: string | undefined) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export function ConfirmationDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  title,
  description,
  confirmLabel,
  confirmText,
  cancelLabel = 'Cancel',
  confirmationText,
  requiredConfirmation,
  confirmationLabel,
  destructive = false,
  onConfirm,
  onError,
}: ConfirmationDialogProps): ReactNode {
  const effectiveConfirmLabel = confirmLabel ?? confirmText ?? 'Confirm';
  const effectiveRequiredText = confirmationText ?? requiredConfirmation;
  const confirmationId = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const [pending, setPending] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmationMatches = !effectiveRequiredText || confirmationValue === effectiveRequiredText;

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmationValue('');
      setError(null);
    }
  }

  async function handleConfirm(): Promise<void> {
    if (!confirmationMatches) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(effectiveRequiredText ? confirmationValue : undefined);
      handleOpenChange(false);
    } catch (cause) {
      setError('Unable to complete this action.');
      onError?.(cause);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {effectiveRequiredText ? (
          <div className="grid gap-2">
            <Label htmlFor={confirmationId}>{confirmationLabel ?? `Type ${effectiveRequiredText} to confirm`}</Label>
            <Input
              id={confirmationId}
              value={confirmationValue}
              onChange={(event) => setConfirmationValue(event.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={pending || !confirmationMatches}
          >
            {effectiveConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
