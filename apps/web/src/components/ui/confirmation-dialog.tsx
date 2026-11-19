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
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmationText?: string;
  confirmationLabel?: string;
  destructive?: boolean;
  onConfirm: (confirmation: string | undefined) => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmationText,
  confirmationLabel,
  destructive = false,
  onConfirm,
  onError,
}: ConfirmationDialogProps): ReactNode {
  const confirmationId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmationValue, setConfirmationValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmationMatches = !confirmationText || confirmationValue === confirmationText;

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
      await onConfirm(confirmationText ? confirmationValue : undefined);
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
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {confirmationText ? (
          <div className="grid gap-2">
            <Label htmlFor={confirmationId}>{confirmationLabel ?? `Type ${confirmationText} to confirm`}</Label>
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
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
