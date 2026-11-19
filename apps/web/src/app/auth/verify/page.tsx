'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyPage(): React.ReactNode {
  const [state, setState] = useState<'reading' | 'verifying' | 'success' | 'error'>('reading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // SECURITY INVARIANT: Verify token arrives in URL fragment (#token=...), NEVER query string!
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    if (!token) {
      setState('error');
      setErrorMessage('Missing verification token in URL fragment. Please check your verification link.');
      return;
    }

    setState('verifying');
    apiClient
      .post('/auth/verify', { token })
      .then(() => {
        // Strip fragment from window history to avoid leaving token in history
        window.history.replaceState(null, '', window.location.pathname);
        setState('success');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Invalid or expired verification token.';
        setErrorMessage(msg);
        setState('error');
      });
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />

      <Card className="w-full max-w-md border-line/40 shadow-2xl text-center">
        <CardHeader className="space-y-2">
          {state === 'reading' || state === 'verifying' ? (
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-peri/20 text-peri-2 border border-peri/30">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : state === 'success' ? (
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/20 text-success border border-success/30">
              <CheckCircle2 className="size-6" />
            </div>
          ) : (
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/20 text-destructive border border-destructive/30">
              <XCircle className="size-6" />
            </div>
          )}

          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            {state === 'verifying' || state === 'reading'
              ? 'Verifying Account...'
              : state === 'success'
              ? 'Account Verified'
              : 'Verification Failed'}
          </CardTitle>
          <CardDescription className="text-ink-2">
            {state === 'success'
              ? 'Your email address has been verified. You can now access your studio.'
              : state === 'error'
              ? 'We could not verify your email address.'
              : 'Securing your cryptographic identity...'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          {state === 'success' ? (
            <Link href="/auth/login">
              <Button variant="default">Proceed to Sign In</Button>
            </Link>
          ) : state === 'error' ? (
            <Link href="/auth/signup">
              <Button variant="ghost">Return to Sign Up</Button>
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
