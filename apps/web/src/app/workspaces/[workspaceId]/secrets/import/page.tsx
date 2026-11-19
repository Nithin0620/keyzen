'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { envImportSchema, type EnvImportInput } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, ArrowRight, Loader2 } from 'lucide-react';

export default function ImportEnvPage({
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
    setValue,
    formState: { errors },
  } = useForm<EnvImportInput>({
    resolver: zodResolver(envImportSchema),
    defaultValues: {
      environmentId: environmentId ?? '',
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setValue('contents', text, { shouldValidate: true });
      }
    };
    reader.readAsText(file);
  };

  const onSubmit = async (data: EnvImportInput): Promise<void> => {
    if (!projectId) {
      setServerError('Project context is missing.');
      return;
    }
    setServerError(null);
    setSubmitting(true);
    try {
      await apiClient.post(
        `/workspaces/${workspaceId}/projects/${projectId}/secrets/import`,
        data
      );
      router.push(`/workspaces/${workspaceId}/secrets?project=${projectId}&env=${data.environmentId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import .env contents';
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
            <Upload className="size-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Import .env Configuration
          </CardTitle>
          <CardDescription className="text-ink-2">
            Paste or upload a .env file. Key-value pairs will be parsed and encrypted into this environment.
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
              <Label htmlFor="file" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Upload File (Optional)
              </Label>
              <Input
                id="file"
                type="file"
                accept=".env,.txt"
                onChange={handleFileUpload}
                className="bg-black/20 border-line text-ink file:bg-peri file:text-white file:border-0 file:rounded-md file:mr-4 file:px-2 file:py-1 file:text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contents" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Raw .env File Content
              </Label>
              <Textarea
                id="contents"
                placeholder={`DATABASE_URL=postgres://...\nSTRIPE_KEY=sk_live_...\nPORT=8080`}
                {...register('contents')}
                className="bg-black/20 border-line text-ink font-mono text-xs resize-none"
                rows={10}
              />
              {errors.contents && (
                <p className="text-xs text-destructive">{errors.contents.message}</p>
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
                    <Loader2 className="mr-2 size-4 animate-spin" /> Parsing & Sealing...
                  </>
                ) : (
                  <>
                    Import Secrets <ArrowRight className="ml-2 size-4" />
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
