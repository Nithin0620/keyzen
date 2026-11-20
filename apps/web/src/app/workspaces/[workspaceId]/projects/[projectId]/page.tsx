'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  Plus,
  Archive,
  RotateCcw,
  Copy,
  GitCompare,
  Trash2,
  KeyRound,
  Fingerprint,
  Webhook,
  Users,
} from 'lucide-react';

export interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  archivedAt?: string | null;
  createdAt: string;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  slug: string;
  archivedAt?: string | null;
  createdAt: string;
  secretCount?: number;
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}): React.ReactNode {
  const { workspaceId, projectId } = use(params);
  const router = useRouter();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    refetch: refetchProject,
  } = useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: () => apiClient.get<ProjectDetail>(`/workspaces/${workspaceId}/projects/${projectId}`),
  });

  const {
    data: environments,
    isLoading: envsLoading,
    isError: envsError,
    refetch: refetchEnvs,
  } = useQuery({
    queryKey: ['project-environments', workspaceId, projectId],
    queryFn: () =>
      apiClient.get<EnvironmentSummary[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/environments`
      ),
  });

  if (projectLoading || envsLoading) {
    return <LoadingState message="Loading project details & environments..." />;
  }

  if (projectError || !project) {
    return (
      <ErrorState
        title="Project not found"
        description="Could not load this project. It might have been deleted or you lack permissions."
        onRetry={() => void refetchProject()}
      />
    );
  }

  const isArchived = Boolean(project.archivedAt);

  const handleArchive = async (): Promise<void> => {
    if (isArchived) {
      await apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/restore`, {});
    } else {
      await apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/archive`, {});
    }
    await refetchProject();
  };

  const handleDelete = async (confirmationText: string | undefined): Promise<void> => {
    if (!confirmationText) return;
    await apiClient.delete(`/workspaces/${workspaceId}/projects/${projectId}`, {
      confirmation: confirmationText,
    });
    router.push(`/workspaces/${workspaceId}/projects`);
  };

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-ink">{project.name}</h1>
            {isArchived ? (
              <Badge variant="secondary" className="gap-1">
                <Archive className="size-3" /> Archived
              </Badge>
            ) : (
              <Badge variant="live">ACTIVE</Badge>
            )}
          </div>
          <p className="font-mono text-xs text-ink-3">
            /{project.slug} &bull; {project.description || 'No description provided.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {environments && environments.length >= 2 && (
            <Link
              href={`/workspaces/${workspaceId}/projects/${projectId}/diff?from=${environments[0].id}&to=${environments[1].id}`}
            >
              <Button variant="ghost" size="sm">
                <GitCompare className="mr-1.5 size-3.5" /> Compare Environments
              </Button>
            </Link>
          )}

          <Link href={`/workspaces/${workspaceId}/projects/${projectId}/credentials`}>
            <Button variant="ghost" size="sm">
              <Fingerprint className="mr-1.5 size-3.5" /> Service Tokens
            </Button>
          </Link>

          <Link href={`/workspaces/${workspaceId}/projects/${projectId}/webhooks`}>
            <Button variant="ghost" size="sm">
              <Webhook className="mr-1.5 size-3.5" /> Webhooks
            </Button>
          </Link>

          <Link href={`/workspaces/${workspaceId}/projects/${projectId}/members`}>
            <Button variant="ghost" size="sm">
              <Users className="mr-1.5 size-3.5" /> Members
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleArchive()}
            title={isArchived ? 'Restore project' : 'Archive project'}
          >
            {isArchived ? (
              <>
                <RotateCcw className="mr-1.5 size-3.5" /> Restore
              </>
            ) : (
              <>
                <Archive className="mr-1.5 size-3.5" /> Archive
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 className="mr-1.5 size-3.5" /> Delete
          </Button>

          {!isArchived && (
            <Link href={`/workspaces/${workspaceId}/projects/${projectId}/environments/new`}>
              <Button variant="default" size="sm">
                <Plus className="mr-1.5 size-3.5" /> New Environment
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Environments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Environments</h2>
          <span className="font-mono text-xs text-ink-3">
            {environments?.length ?? 0} {environments?.length === 1 ? 'Environment' : 'Environments'}
          </span>
        </div>

        {envsError && (
          <ErrorState
            title="Could not load environments"
            description="Failed to retrieve environments for this project."
            onRetry={() => void refetchEnvs()}
          />
        )}

        {environments && environments.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {environments.map((env) => {
              const envArchived = Boolean(env.archivedAt);
              return (
                <Card
                  key={env.id}
                  className={`transition-all duration-200 hover:border-peri/40 ${
                    envArchived ? 'opacity-60 bg-black/40' : ''
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardTitle className="text-base font-medium text-ink">{env.name}</CardTitle>
                      <span className="font-mono text-xs text-ink-3">/{env.slug}</span>
                    </div>
                    {envArchived ? (
                      <Badge variant="secondary">Archived</Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        LIVE
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-line/20 pt-3 text-xs">
                      <Link
                        href={`/workspaces/${workspaceId}/secrets?project=${projectId}&env=${env.id}`}
                        className="inline-flex items-center gap-1.5 text-peri-2 hover:underline"
                      >
                        <KeyRound className="size-3.5" />
                        <span>Manage Secrets</span>
                      </Link>

                      <Link
                        href={`/workspaces/${workspaceId}/projects/${projectId}/environments/${env.id}/duplicate`}
                        className="inline-flex items-center gap-1 text-ink-3 hover:text-ink"
                        title="Duplicate environment"
                      >
                        <Copy className="size-3.5" />
                        <span>Duplicate</span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No environments configured"
            description="Create an environment such as 'development', 'staging', or 'production'."
            action={
              <Link href={`/workspaces/${workspaceId}/projects/${projectId}/environments/new`}>
                <Button variant="default">
                  <Plus className="mr-2 size-4" /> Create Environment
                </Button>
              </Link>
            }
          />
        )}
      </div>

      {/* Typed Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title={`Delete project "${project.name}"?`}
        description="This action is permanent and cannot be undone. All environments and scoped secrets will be permanently deleted."
        confirmText="Delete Project"
        requiredConfirmation={project.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
