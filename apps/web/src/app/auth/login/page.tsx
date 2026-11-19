'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@aegis/shared';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api/client';

export default function LoginPage(): React.ReactNode {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') ?? '/dashboard';

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      router.push(redirectPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials or login failed';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />

      <Card className="w-full max-w-md border-line/40 shadow-2xl">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <ShieldCheck className="size-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Sign in to <span className="font-serif italic text-peri-2">Aegis</span>
          </CardTitle>
          <CardDescription className="text-ink-2">
            Secure, programmatic secret curation studio
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
                className="bg-black/20 border-line text-ink placeholder:text-ink-3/50"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                  Password
                </Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-peri-2 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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
                  <Loader2 className="mr-2 size-4 animate-spin" /> Signing In...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="ml-2 size-4" />
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
            className="flex h-10 w-full items-center justify-center rounded-[10px] border border-line bg-black/20 text-sm font-medium text-ink transition-colors hover:bg-black/40"
          >
            Continue with Google OAuth
          </a>
        </CardContent>
        <CardFooter className="justify-center border-t border-line/20 pt-4 text-xs text-ink-3">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="ml-1 text-peri-2 hover:underline">
            Create account
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
