'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordResetRequestSchema, type PasswordResetRequestInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage(): React.ReactNode {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestInput>({
    resolver: zodResolver(passwordResetRequestSchema),
  });

  const onSubmit = async (data: PasswordResetRequestInput): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      await apiClient.post('/auth/password/reset-request', { email: data.email });
      setSubmittedEmail(data.email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset link.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />
        <Card className="w-full max-w-md border-line/40 shadow-2xl text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/20 text-success border border-success/30">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="mt-4 text-2xl font-light tracking-tight text-ink">
              Reset Link Sent
            </CardTitle>
            <CardDescription className="text-ink-2">
              If an account exists for <span className="font-mono text-ink">{submittedEmail}</span>, instructions to reset your password have been sent.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            Please check your spam or promotions folder if you don&apos;t see it within a couple of minutes.
          </CardContent>
          <CardFooter className="justify-center">
            <Link href="/auth/login">
              <Button variant="ghost">Return to Sign In</Button>
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
            Reset Password
          </CardTitle>
          <CardDescription className="text-ink-2">
            Enter your email to receive a recovery link
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
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="developer@company.com"
                autoComplete="email"
                {...register('email')}
                className="bg-black/20 border-line text-ink"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full font-medium">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Sending Link...
                </>
              ) : (
                <>
                  Send Reset Link <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center border-t border-line/20 pt-4 text-xs text-ink-3">
          Remember your password?{' '}
          <Link href="/auth/login" className="ml-1 text-peri-2 hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
