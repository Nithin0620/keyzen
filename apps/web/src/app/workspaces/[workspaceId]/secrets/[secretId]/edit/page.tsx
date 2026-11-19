'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { secretValueUpsertSchema, type SecretValueUpsertInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { KeyRound, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';

export default function EditSecretValuePage({
  params,
}: {
  params: Promise<{ workspaceId: string; secretId: string }>;
}): React.ReactNode {
  const { workspaceId, secretId } = use(params);
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
  } = useForm<SecretValueUpsertInput>({
    resolver: zodResolver(secretValueUpsertSchema),
  });

  const onSubmit = async (data: SecretValueUpsertInput): Promise<void> => {
    if (!projectId || !environmentId) {
      setServerError('Project or environment context missing.');
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await apiClient.put(
        `/workspaces/${workspaceId}/projects/${projectId}/secrets/${secretId}/environments/${environmentId}/value`,
        data
      );
      router.push(`/workspaces/${workspaceId}/secrets?project=${projectId}&env=${environmentId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update secret value';
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
            Update Secret Value
          </CardTitle>
          <CardDescription className="text-ink-2">
            Writing a new secret value creates a new version in this environment and increments history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg border border-line/20 bg-black/20 p-3 text-xs text-ink-3 flex items-center gap-2">
              <ShieldAlert className="size-4 text-warning shrink-0" />
              <span>
                Existing secret value is never shown here. Enter the replacement plaintext value below to re-seal.
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="value" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                New Plaintext Value
              </Label>
              <Textarea
                id="value"
                placeholder="Enter new secret value..."
                {...register('value')}
                className="bg-black/20 border-line text-ink font-mono text-xs resize-none"
                rows={5}
              />
              {errors.value && (
                <p className="text-xs text-destructive">{errors.value.message}</p>
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
                    <Loader2 className="mr-2 size-4 animate-spin" /> Sealing New Version...
                  </>
                ) : (
                  <>
                    Save & Increment Version <ArrowRight className="ml-2 size-4" />
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
