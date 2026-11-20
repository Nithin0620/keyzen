'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@aegis/shared';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api/client';

export default function SignupPage(): React.ReactNode {
  const { signup } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupInput): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      await signup(data.email, data.password, data.name);
      setSuccessEmail(data.email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Signup failed. Please try again.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (successEmail) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />

        {/* Auth Navigation */}
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-ink hover:text-peri-2 transition-colors">
            <ShieldCheck className="size-5" />
            <span className="font-semibold tracking-tight">Aegis</span>
          </Link>
          <Link href="/" className="text-sm text-ink-2 hover:text-ink transition-colors flex items-center gap-1">
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </div>

        <Card className="w-full max-w-md border-line/40 shadow-2xl text-center">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/20 text-success border border-success/30">
              <CheckCircle2 className="size-6" />
            </div>
            <CardTitle className="mt-4 text-2xl font-light tracking-tight text-ink">
              Check your inbox
            </CardTitle>
            <CardDescription className="text-ink-2">
              We sent a verification link to <span className="font-mono text-ink">{successEmail}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-ink-3">
            Click the link in the email to activate your account. The link will arrive with a secure verification fragment.
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

      {/* Auth Navigation */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-ink hover:text-peri-2 transition-colors">
          <ShieldCheck className="size-5" />
          <span className="font-semibold tracking-tight">Aegis</span>
        </Link>
        <Link href="/" className="text-sm text-ink-2 hover:text-ink transition-colors flex items-center gap-1">
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
      </div>

      <Card className="w-full max-w-md border-line/40 shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <ShieldCheck className="size-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Create your <span className="font-serif italic text-peri-2">Aegis</span> account
          </CardTitle>
          <CardDescription className="text-ink-2">
            Start managing your secrets with military-grade encryption
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
              <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Ada Lovelace"
                autoComplete="name"
                {...register('name')}
                className="bg-black/20 border-line text-ink"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Work Email
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

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Password (min 12 chars)
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                className="bg-black/20 border-line text-ink"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full font-medium">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Creating Account...
                </>
              ) : (
                <>
                  Get Started <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-6 text-center text-xs">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line/30" />
            </div>
            <span className="relative bg-violet-deep px-2 font-mono text-ink-3">OR</span>
          </div>

          <a
            href={`${getApiBaseUrl()}/auth/google`}
            onClick={() => setOauthLoading(true)}
            className={`flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-black/20 text-sm font-medium text-ink transition-colors hover:bg-black/40 ${
              oauthLoading ? 'pointer-events-none opacity-80' : ''
            }`}
          >
            {oauthLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin text-peri-2" />
                Connecting to Google...
              </>
            ) : (
              'Continue with Google'
            )}
          </a>
        </CardContent>
        <CardFooter className="justify-center border-t border-line/20 pt-4 text-xs text-ink-3">
          Already have an account?{' '}
          <Link href="/auth/login" className="ml-1 text-peri-2 hover:underline">
            Sign in
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
