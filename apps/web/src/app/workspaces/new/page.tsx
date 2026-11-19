'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workspaceCreateSchema, type WorkspaceCreateInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building, ArrowRight, Loader2 } from 'lucide-react';

export default function NewWorkspacePage(): React.ReactNode {
  const router = useRouter();
  const { reloadWorkspaces, selectWorkspace } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<WorkspaceCreateInput>({
    resolver: zodResolver(workspaceCreateSchema),
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

  const onSubmit = async (data: WorkspaceCreateInput): Promise<void> => {
    setServerError(null);
    setSubmitting(true);
    try {
      const created = await apiClient.post<{ id: string; name: string; slug: string }>('/workspaces', data);
      await reloadWorkspaces();
      await selectWorkspace(created.id);
      router.push(`/workspaces/${created.id}/projects`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 bg-navy">
      <div className="ambient-scene pointer-events-none fixed inset-0 -z-10" />

      <Card className="w-full max-w-lg border-line/40 shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <Building className="size-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Create a New Workspace
          </CardTitle>
          <CardDescription className="text-ink-2">
            Workspaces represent independent tenant boundaries for projects and keys.
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
                Workspace Name
              </Label>
              <Input
                id="name"
                placeholder="Acme Operations"
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
                Workspace Slug
              </Label>
              <Input
                id="slug"
                placeholder="acme-operations"
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
                placeholder="Production infrastructure and secrets management"
                {...register('description')}
                className="bg-black/20 border-line text-ink resize-none"
                rows={3}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full font-medium">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Provisioning Tenant...
                </>
              ) : (
                <>
                  Create Workspace <ArrowRight className="ml-2 size-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
