'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import {
  History,
  RotateCcw,
  ArrowLeft,
  Clock,
  User,
} from 'lucide-react';

export interface SecretHistoryEntry {
  version: number;
  changedBy: string;
  createdAt: string;
  requestId?: string;
}

export default function SecretHistoryPage({
  params,
}: {
  params: Promise<{ workspaceId: string; secretId: string }>;
}): React.ReactNode {
  const { workspaceId, secretId } = use(params);
  const searchParams = useSearchParams();

  const projectId = searchParams.get('project');
  const environmentId = searchParams.get('env');

  const [selectedVersionForRollback, setSelectedVersionForRollback] = useState<number | null>(null);
  const [rollbackModalOpen, setRollbackModalOpen] = useState(false);

  // Secret basic metadata
  const { data: secret } = useQuery({
    queryKey: ['secret-meta', workspaceId, projectId, secretId],
    queryFn: () =>
      apiClient.get<{ id: string; name: string; description?: string }>(
        `/workspaces/${workspaceId}/projects/${projectId}/secrets/${secretId}`
      ),
    enabled: Boolean(projectId),
  });

  // History timeline
  const {
    data: history,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['secret-history', workspaceId, projectId, secretId, environmentId],
    queryFn: () =>
      apiClient.get<SecretHistoryEntry[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/secrets/${secretId}/history`,
        {
          searchParams: {
            environmentId: environmentId ?? '',
            limit: 50,
          },
        }
      ),
    enabled: Boolean(projectId && environmentId),
  });

  const handleRollback = async (): Promise<void> => {
    if (!selectedVersionForRollback || !environmentId) return;
    await apiClient.post(
      `/workspaces/${workspaceId}/projects/${projectId}/secrets/${secretId}/environments/${environmentId}/rollback`,
      {
        version: selectedVersionForRollback,
        confirmation: 'ROLLBACK',
      }
    );
    await refetch();
    setRollbackModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-line/20 pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/workspaces/${workspaceId}/secrets?project=${projectId}&env=${environmentId}`}>
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-light tracking-tight text-ink">
                Version History: <span className="font-mono text-peri-2">{secret?.name ?? 'Secret'}</span>
              </h1>
              <Badge variant="live">AUDITED TIMELINE</Badge>
            </div>
            <p className="text-xs text-ink-3">
              Immutable version trail. Rollbacks create new versions and preserve history.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading immutable version timeline..." />
      ) : isError ? (
        <ErrorState
          title="Could not load history"
          description="Failed to load version history for this secret."
          onRetry={() => void refetch()}
        />
      ) : history && history.length > 0 ? (
        <div className="space-y-4">
          <Card className="border-line/40 shadow-2xl overflow-hidden">
            <div className="divide-y divide-line/20 font-mono text-xs">
              {history.map((entry, index) => {
                const isLatest = index === 0;
                return (
                  <div
                    key={entry.version}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-black/40 border border-line text-peri-2 font-bold shrink-0">
                        v{entry.version}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">
                            Version {entry.version}
                          </span>
                          {isLatest && <Badge variant="live">LATEST ACTIVE</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-sans text-ink-3">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3 text-ink-3" />
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="size-3 text-ink-3" />
                            Actor: {entry.changedBy}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {!isLatest && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-peri-2 hover:bg-peri/10"
                          onClick={() => {
                            setSelectedVersionForRollback(entry.version);
                            setRollbackModalOpen(true);
                          }}
                        >
                          <RotateCcw className="size-3.5" /> Rollback to v{entry.version}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : (
        <EmptyState
          title="No history records found"
          description="This secret has no previous version records in this environment."
          icon={History}
        />
      )}

      {/* Rollback confirmation dialog */}
      <ConfirmationDialog
        open={rollbackModalOpen}
        onOpenChange={setRollbackModalOpen}
        title={`Rollback to Version ${selectedVersionForRollback}?`}
        description={`This will restore the encrypted value from Version ${selectedVersionForRollback} as a brand-new active version. Type ROLLBACK to confirm.`}
        confirmText="Confirm Rollback"
        requiredConfirmation="ROLLBACK"
        onConfirm={handleRollback}
      />
    </div>
  );
}
