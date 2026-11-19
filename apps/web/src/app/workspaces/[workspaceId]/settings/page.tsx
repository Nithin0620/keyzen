'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { Settings, Trash2, Save, Loader2 } from 'lucide-react';

interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role?: string;
}

export default function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { reloadWorkspaces } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const {
    data: workspace,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workspace-detail', workspaceId],
    queryFn: async () => {
      const ws = await apiClient.get<WorkspaceDetail>(`/workspaces/${workspaceId}`);
      setName(ws.name);
      setDescription(ws.description ?? '');
      return ws;
    },
  });

  if (isLoading) {
    return <LoadingState message="Loading workspace settings..." />;
  }

  if (isError || !workspace) {
    return (
      <ErrorState
        title="Could not load workspace settings"
        description="Verify you have administrative access to this workspace."
        onRetry={() => void refetch()}
      />
    );
  }

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setServerError(null);
    setSaveSuccess(false);
    try {
      await apiClient.put(`/workspaces/${workspaceId}`, {
        name,
        description: description || undefined,
      });
      await reloadWorkspaces();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update workspace settings';
      setServerError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (confirmationText: string | undefined): Promise<void> => {
    if (!confirmationText) return;
    await apiClient.delete(`/workspaces/${workspaceId}`, {
      confirmation: confirmationText,
    });
    await reloadWorkspaces();
    router.push('/dashboard');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Settings Form */}
      <Card className="border-line/40 shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-peri to-peri-2 shadow-peri-glow">
            <Settings className="size-5 text-white" />
          </div>
          <CardTitle className="text-2xl font-light tracking-tight text-ink">
            Workspace Settings
          </CardTitle>
          <CardDescription className="text-ink-2">
            Configure tenant name and metadata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            {saveSuccess && (
              <Alert variant="success">
                <AlertDescription>Settings updated successfully.</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="slug" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Workspace Slug (Immutable)
              </Label>
              <Input
                id="slug"
                value={workspace.slug}
                disabled
                className="bg-black/40 border-line text-ink-3 font-mono text-xs cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Workspace Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-black/20 border-line text-ink"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs font-mono uppercase tracking-wider text-ink-3">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-black/20 border-line text-ink resize-none"
                rows={3}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-destructive/5 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-destructive">Danger Zone</CardTitle>
          <CardDescription className="text-ink-2">
            Permanently delete this workspace and all associated projects, environments, and secrets.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-between items-center border-t border-destructive/20 pt-4">
          <p className="text-xs text-ink-3">This action cannot be undone.</p>
          <Button
            variant="destructive"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 className="mr-2 size-4" /> Delete Workspace
          </Button>
        </CardFooter>
      </Card>

      {/* Typed Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title={`Delete workspace "${workspace.name}"?`}
        description="All projects, environments, secret vaults, and member assignments in this workspace will be permanently destroyed."
        confirmText="Delete Workspace"
        requiredConfirmation={workspace.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
