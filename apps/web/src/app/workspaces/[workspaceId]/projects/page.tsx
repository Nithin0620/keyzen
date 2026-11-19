'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { FolderGit2, Plus, ArrowRight, Layers, Archive } from 'lucide-react';

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  archivedAt?: string | null;
  createdAt: string;
  environmentCount?: number;
  secretCount?: number;
}

export default function WorkspaceProjectsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);

  const {
    data: projects,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: () => apiClient.get<ProjectSummary[]>(`/workspaces/${workspaceId}/projects`),
  });

  if (isLoading) {
    return <LoadingState message="Loading projects for workspace..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load projects"
        description="Could not load projects for this workspace. You might lack permissions or the workspace does not exist."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-ink">
            Projects <span className="font-serif italic text-peri-2">Studio</span>
          </h1>
          <p className="text-sm text-ink-2">
            Organize secrets, keys, and environments within this workspace boundary.
          </p>
        </div>
        <Link href={`/workspaces/${workspaceId}/projects/new`}>
          <Button variant="default">
            <Plus className="mr-2 size-4" /> New Project
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => {
            const isArchived = Boolean(proj.archivedAt);
            return (
              <Link
                key={proj.id}
                href={`/workspaces/${workspaceId}/projects/${proj.id}`}
                className="group block"
              >
                <Card
                  className={`h-full transition-all duration-300 hover:border-peri/40 hover:-translate-y-1 ${
                    isArchived ? 'opacity-60 bg-black/40' : ''
                  }`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-peri/20 text-peri-2 border border-peri/30">
                      <FolderGit2 className="size-4" />
                    </div>
                    {isArchived ? (
                      <Badge variant="secondary" className="gap-1">
                        <Archive className="size-3" /> Archived
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        ACTIVE
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div>
                      <CardTitle className="text-lg font-medium text-ink group-hover:text-peri-2 transition-colors">
                        {proj.name}
                      </CardTitle>
                      <span className="font-mono text-xs text-ink-3">/{proj.slug}</span>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs text-ink-2">
                      {proj.description || 'No description provided.'}
                    </CardDescription>

                    <div className="flex items-center justify-between border-t border-line/20 pt-3 text-xs text-ink-3">
                      <div className="flex items-center gap-1.5">
                        <Layers className="size-3.5" />
                        <span>Manage Environments</span>
                      </div>
                      <ArrowRight className="size-4 text-peri-2 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 duration-200" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No projects found"
          description="Create your first project to start organizing environments and secrets."
          action={
            <Link href={`/workspaces/${workspaceId}/projects/new`}>
              <Button variant="default">
                <Plus className="mr-2 size-4" /> Create Project
              </Button>
            </Link>
          }
        />
      )}
    </div>
  );
}
