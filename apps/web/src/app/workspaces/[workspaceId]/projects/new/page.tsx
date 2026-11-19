'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectCreateSchema, type ProjectCreateInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FolderGit2, ArrowRight, Loader2 } from 'lucide-react';

export default function NewProjectPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
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

  const onSubmit = async (data: ProjectCreateInput): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      const created = await apiClient.post<{ id: string; name: string }>(
        `/workspaces/${workspaceId}/projects`,
        data
      );
      router.push(`/workspaces/${workspaceId}/projects/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-line/40 shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-purple-400 shadow-peri-glow">
            <FolderGit2 className="size-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Create Project
          </CardTitle>
          <CardDescription className="text-ink-2">
            A project contains environments (e.g. dev, staging, prod) and scoped secrets.
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
                Project Name
              </Label>
              <Input
                id="name"
                placeholder="Payment Gateway API"
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
                Project Slug
              </Label>
              <Input
                id="slug"
                placeholder="payment-gateway-api"
                {...register('slug')}
                className="bg-black/20 border-line text-ink font-mono text-xs"
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Core payment processing microservice secrets and keys"
                {...register('description')}
                className="bg-black/20 border-line text-ink resize-none"
                rows={3}
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
                    <Loader2 className="mr-2 size-4 animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    Create Project <ArrowRight className="ml-2 size-4" />
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
