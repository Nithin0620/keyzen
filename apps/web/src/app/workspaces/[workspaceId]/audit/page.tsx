'use client';

import { Fragment, use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditView } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  RefreshCw,
  User,
  Bot,
  Cog,
  Filter,
} from 'lucide-react';

interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
}

function ActorIcon({ actorType }: { actorType: AuditView['actorType'] }): React.ReactNode {
  if (actorType === 'USER') return <User className="size-3.5 text-peri-2" />;
  if (actorType === 'SERVICE_TOKEN') return <Bot className="size-3.5 text-warning" />;
  return <Cog className="size-3.5 text-ink-3" />;
}

function ActionBadge({ action }: { action: string }): React.ReactNode {
  const color = action.includes('delete') || action.includes('revoke') || action.includes('remove')
    ? 'destructive'
    : action.includes('create') || action.includes('invite') || action.includes('accept')
    ? 'success'
    : action.includes('update') || action.includes('rotate') || action.includes('rollback')
    ? 'secondary'
    : 'outline';

  return (
    <Badge variant={color as 'outline' | 'secondary' | 'destructive' | 'success'} className="font-mono text-[10px]">
      {action}
    </Badge>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

const LIMIT_OPTIONS = [25, 50, 100, 200];

export default function AuditLogPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: projects } = useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: () => apiClient.get<ProjectSummary[]>(`/workspaces/${workspaceId}/projects`),
  });

  const {
    data: logs,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['audit-logs', workspaceId, selectedProjectId, limit],
    queryFn: () =>
      apiClient.get<AuditView[]>(`/workspaces/${workspaceId}/audit`, {
        searchParams: {
          limit,
          ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        },
      }),
  });

  if (isLoading) {
    return <LoadingState message="Loading audit log..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Audit log unavailable"
        description="You may lack audit.read permission or the workspace could not be found."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-ink">
              Audit <span className="font-serif italic text-peri-2">Trail</span>
            </h1>
            <Badge variant="live">IMMUTABLE LOG</Badge>
          </div>
          <p className="text-sm text-ink-2 mt-1">
            Every secret read, member change, token event, and billing action — attributed and timestamped.
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="shrink-0 text-ink-3 hover:text-ink"
        >
          <RefreshCw className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-ink-3">
          <Filter className="size-3.5" />
          <span className="font-mono text-xs uppercase tracking-wider">Filters</span>
        </div>

        <Select
          value={selectedProjectId || '__all__'}
          onValueChange={(v) => setSelectedProjectId(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-8 w-48 bg-black/20 border-line text-xs text-ink">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent className="border-line/40 bg-popover text-ink">
            <SelectItem value="__all__">All projects</SelectItem>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
          <SelectTrigger className="h-8 w-32 bg-black/20 border-line text-xs text-ink">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-line/40 bg-popover text-ink">
            {LIMIT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Last {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(selectedProjectId || limit !== 50) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-ink-3 hover:text-ink"
            onClick={() => { setSelectedProjectId(''); setLimit(50); }}
          >
            Reset
          </Button>
        )}

        <span className="ml-auto font-mono text-xs text-ink-3">
          {logs?.length ?? 0} events
        </span>
      </div>

      {/* Log Table */}
      {logs && logs.length > 0 ? (
        <Card className="border-line/40 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line/20 bg-black/40 font-mono text-[11px] tracking-wider uppercase text-ink-3">
                <tr>
                  <th className="py-3 px-5 font-medium">When</th>
                  <th className="py-3 px-5 font-medium">Actor</th>
                  <th className="py-3 px-5 font-medium">Action</th>
                  <th className="py-3 px-5 font-medium">Project</th>
                  <th className="py-3 px-5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {logs.map((log) => {
                  const proj = projects?.find((p) => p.id === log.projectId);
                  const isExpanded = expandedId === log.id;
                  const hasMetadata = Object.keys(log.metadata).length > 0;

                  return (
                    <Fragment key={log.id}>
                      <tr
                        className={`transition-colors hover:bg-white/[0.02] ${hasMetadata ? 'cursor-pointer' : ''}`}
                        onClick={() => hasMetadata && setExpandedId(isExpanded ? null : log.id)}
                      >
                        <td className="py-3.5 px-5 font-sans text-ink-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-ink">{formatRelativeTime(log.createdAt)}</span>
                            <span className="text-[10px] text-ink-3/60 font-mono">
                              {new Date(log.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <ActorIcon actorType={log.actorType} />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="font-mono text-ink text-[10px] truncate max-w-[120px]">
                                {log.actorId.slice(-12)}
                              </span>
                              <span className="font-mono text-[9px] text-ink-3 uppercase tracking-wider">
                                {log.actorType.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <ActionBadge action={log.action} />
                        </td>
                        <td className="py-3.5 px-5 font-mono text-ink-3 text-[11px]">
                          {proj?.name ?? (log.projectId ? log.projectId.slice(-8) : <span className="text-ink-3/40">workspace</span>)}
                        </td>
                        <td className="py-3.5 px-5 text-ink-3">
                          {hasMetadata ? (
                            <button className="font-mono text-[10px] text-peri-2 hover:underline">
                              {isExpanded ? 'collapse ▲' : 'expand ▼'}
                            </button>
                          ) : (
                            <span className="text-ink-3/30 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasMetadata && (
                        <tr className="bg-black/30">
                          <td colSpan={5} className="px-5 py-3">
                            <div className="rounded-lg border border-line/20 bg-black/40 p-3">
                              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3 mb-2">Metadata</p>
                              <pre className="font-mono text-xs text-peri-2 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                              {log.ipHash && (
                                <p className="mt-2 font-mono text-[10px] text-ink-3">
                                  IP hash: <span className="text-ink">{log.ipHash}</span>
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No audit events found"
          description={
            selectedProjectId
              ? 'No events recorded for this project yet. Try removing the project filter.'
              : 'No events recorded in this workspace yet. Activity will appear here as you use Aegis.'
          }
          action={
            selectedProjectId ? (
              <Button variant="ghost" onClick={() => setSelectedProjectId('')}>
                Clear filter
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Footer note */}
      <p className="text-xs text-ink-3/60 font-mono text-center">
        Audit records are immutable and retained per workspace retention policy. Metadata fields never contain secret values.
      </p>
    </div>
  );
}
