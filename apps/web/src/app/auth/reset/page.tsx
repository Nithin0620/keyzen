'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

const resetFormSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  confirmPassword: z.string().min(12),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetFormInput = z.infer<typeof resetFormSchema>;

export default function ResetPasswordPage(): React.ReactNode {
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // SECURITY INVARIANT: Password reset token arrives in URL fragment (#token=...), NEVER query string!
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const parsedToken = params.get('token');

    if (!parsedToken) {
      setServerError('Missing reset token in URL fragment. Please request a new password reset link.');
    } else {
      setToken(parsedToken);
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormInput>({
    resolver: zodResolver(resetFormSchema),
  });

  const onSubmit = async (data: ResetFormInput): Promise<void> => {
    if (!token) {
      setServerError('No valid reset token found.');
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/auth/password/reset', {
        token,
        password: data.password,
      });
      // Clear URL fragment from browser history
      window.history.replaceState(null, '', window.location.pathname);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset password. Link may have expired.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />
        <Card className="w-full max-w-md border-line/40 shadow-2xl text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/20 text-success border border-success/30">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="mt-4 text-2xl font-light tracking-tight text-ink">
              Password Reset Complete
            </CardTitle>
            <CardDescription className="text-ink-2">
              Your password has been securely updated. You can now sign in with your new credentials.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/auth/login">
              <Button variant="default">Sign In Now</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />

      <Card className="w-full max-w-md border-line/40 shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <ShieldCheck className="size-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Set New Password
          </CardTitle>
          <CardDescription className="text-ink-2">
            Create a strong new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                New Password (min 12 chars)
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={!token}
                {...register('password')}
                className="bg-black/20 border-line text-ink"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={!token}
                {...register('confirmPassword')}
                className="bg-black/20 border-line text-ink"
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" disabled={submitting || !token} className="w-full font-medium">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Updating Password...
                </>
              ) : (
                <>
                  Update Password <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-line/20 pt-4 text-xs text-ink-3">
          <Link href="/auth/login" className="text-peri-2 hover:underline">
            Return to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
