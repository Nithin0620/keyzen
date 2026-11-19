'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { secretCreateSchema, type SecretCreateInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react';

export default function NewSecretPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = searchParams.get('project');
  const environmentId = searchParams.get('env');

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SecretCreateInput>({
    resolver: zodResolver(secretCreateSchema),
    defaultValues: {
      environmentId: environmentId ?? '',
    },
  });

  const onSubmit = async (data: SecretCreateInput): Promise<void> => {
    if (!projectId) {
      setServerError('Project context is missing.');
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/secrets`,
        data
      );
      router.push(`/workspaces/${workspaceId}/secrets?project=${projectId}&env=${data.environmentId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create secret';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card className="border-line/40 shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <KeyRound className="size-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Create Secret
          </CardTitle>
          <CardDescription className="text-ink-2">
            Store an API key, database URL, token, or private certificate. Value is sealed immediately upon receipt.
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
                Key Name (UPPER_CASE_SNAKE)
              </Label>
              <Input
                id="name"
                placeholder="STRIPE_API_KEY"
                {...register('name')}
                className="bg-black/20 border-line text-ink font-mono text-sm"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Secret Value (Sealed)
              </Label>
              <Textarea
                id="value"
                placeholder="sk_live_..."
                {...register('value')}
                className="bg-black/20 border-line text-ink font-mono text-xs resize-none"
                rows={4}
              />
              {errors.value && (
                <p className="text-xs text-destructive">{errors.value.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Description (Optional)
              </Label>
              <Input
                id="description"
                placeholder="Primary payment gateway secret key"
                {...register('description')}
                className="bg-black/20 border-line text-ink"
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Encrypting & Storing...
                  </>
                ) : (
                  <>
                    Save Secret <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
