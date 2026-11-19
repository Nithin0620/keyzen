'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { environmentDuplicateSchema, type EnvironmentDuplicateInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export default function DuplicateEnvironmentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string; environmentId: string }>;
}): React.ReactNode {
  const { workspaceId, projectId, environmentId } = use(params);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<EnvironmentDuplicateInput>({
    resolver: zodResolver(environmentDuplicateSchema),
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    setValue('slug', slug, { shouldValidate: true });
  };

  const onSubmit = async (data: EnvironmentDuplicateInput): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      await apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/environments/${environmentId}/duplicate`,
        data
      );
      router.push(`/workspaces/${workspaceId}/projects/${projectId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate environment';
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
            <Copy className="size-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Duplicate Environment
          </CardTitle>
          <CardDescription className="text-ink-2">
            Clones secret keys and configurations safely. Secret values are re-encrypted server-side with zero plaintext exposure.
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
              <ShieldCheck className="size-4 text-success shrink-0" />
              <span>
                Source secret values remain securely sealed in KMS/envelopes. Plaintext values are never returned to the browser during duplication.
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                New Target Environment Name
              </Label>
              <Input
                id="name"
                placeholder="staging-preview"
                {...register('name')}
                onChange={(e) => {
                  register('name').onChange(e);
                  handleNameChange(e);
                }}
                className="bg-black/20 border-line text-ink"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                New Target Slug
              </Label>
              <Input
                id="slug"
                placeholder="staging-preview"
                {...register('slug')}
                className="bg-black/20 border-line text-ink font-mono text-xs"
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
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
                    <Loader2 className="mr-2 size-4 animate-spin" /> Duplicating...
                  </>
                ) : (
                  <>
                    Duplicate Safely <ArrowRight className="ml-2 size-4" />
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
