'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { GitCompare, ArrowLeft, KeyRound, Check, Minus, Plus } from 'lucide-react';
import type { EnvironmentSummary } from '../page';

export interface SecretDiffItem {
  key: string;
  status: 'identical' | 'modified' | 'added' | 'removed';
  fromVersion?: number;
  toVersion?: number;
}

export interface EnvironmentDiffResult {
  fromEnvironment: { id: string; name: string; slug: string };
  toEnvironment: { id: string; name: string; slug: string };
  diff: SecretDiffItem[];
}

export default function EnvironmentDiffPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}): React.ReactNode {
  const { workspaceId, projectId } = use(params);
  const searchParams = useSearchParams();

  const [fromEnvId, setFromEnvId] = useState<string>(searchParams.get('from') ?? '');
  const [toEnvId, setToEnvId] = useState<string>(searchParams.get('to') ?? '');

  const { data: environments } = useQuery({
    queryKey: ['project-environments', workspaceId, projectId],
    queryFn: () =>
      apiClient.get<EnvironmentSummary[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/environments`
      ),
  });

  const {
    data: diffResult,
    isLoading: diffLoading,
    isError: diffError,
    refetch,
  } = useQuery({
    queryKey: ['env-diff', workspaceId, projectId, fromEnvId, toEnvId],
    queryFn: () =>
      apiClient.get<EnvironmentDiffResult>(
        `/workspaces/${workspaceId}/projects/${projectId}/diff/${fromEnvId}/${toEnvId}`
      ),
    enabled: Boolean(fromEnvId && toEnvId && fromEnvId !== toEnvId),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line/20 pb-4">
        <div className="flex items-center gap-3">
          <Link href={`/workspaces/${workspaceId}/projects/${projectId}`}>
            <Button variant="ghost" size="icon" className="size-8">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-light tracking-tight text-ink">
              Compare <span className="font-serif italic text-peri-2">Environments</span>
            </h1>
            <p className="text-xs text-ink-3">
              Masked diff analysis. Plaintext secret values are never transmitted or revealed.
            </p>
          </div>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-line/30 p-4">
          <label className="text-xs font-mono uppercase text-ink-3 block mb-2">
            Base Environment (Source)
          </label>
          <Select value={fromEnvId} onValueChange={setFromEnvId}>
            <SelectTrigger className="bg-black/20 border-line text-ink">
              <SelectValue placeholder="Select base environment" />
            </SelectTrigger>
            <SelectContent className="border-line/40 bg-popover text-ink">
              {environments?.map((e) => (
                <SelectItem key={e.id} value={e.id} disabled={e.id === toEnvId}>
                  {e.name} (/{e.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        <Card className="border-line/30 p-4">
          <label className="text-xs font-mono uppercase text-ink-3 block mb-2">
            Target Environment (Comparison)
          </label>
          <Select value={toEnvId} onValueChange={setToEnvId}>
            <SelectTrigger className="bg-black/20 border-line text-ink">
              <SelectValue placeholder="Select target environment" />
            </SelectTrigger>
            <SelectContent className="border-line/40 bg-popover text-ink">
              {environments?.map((e) => (
                <SelectItem key={e.id} value={e.id} disabled={e.id === fromEnvId}>
                  {e.name} (/{e.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </div>

      {/* Diff Table / Status */}
      {fromEnvId && toEnvId && fromEnvId === toEnvId ? (
        <Card className="p-8 text-center border-line/30">
          <p className="text-ink-2">Please select two different environments to compare.</p>
        </Card>
      ) : diffLoading ? (
        <LoadingState message="Comparing environment secrets safely..." />
      ) : diffError ? (
        <ErrorState
          title="Could not compute diff"
          description="Failed to compare the environments. Verify you have read access to both environments."
          onRetry={() => void refetch()}
        />
      ) : diffResult ? (
        <Card className="border-line/40 overflow-hidden">
          <CardHeader className="bg-black/20 border-b border-line/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium text-ink">
                  {diffResult.fromEnvironment.name} &rarr; {diffResult.toEnvironment.name}
                </CardTitle>
                <CardDescription className="text-xs font-mono text-ink-3">
                  {diffResult.diff.length} keys evaluated
                </CardDescription>
              </div>
              <Badge variant="live">MASKED DIFF SAFE</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {diffResult.diff.length > 0 ? (
              <div className="divide-y divide-line/20 font-mono text-xs">
                {diffResult.diff.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <KeyRound className="size-4 text-ink-3" />
                      <span className="font-semibold text-ink">{item.key}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-ink-3">
                        v{item.fromVersion ?? '—'} &rarr; v{item.toVersion ?? '—'}
                      </span>

                      {item.status === 'identical' && (
                        <Badge variant="outline" className="border-line/30 text-ink-3">
                          <Check className="mr-1 size-3 text-success" /> In Sync
                        </Badge>
                      )}
                      {item.status === 'modified' && (
                        <Badge variant="warning" className="gap-1">
                          Modified
                        </Badge>
                      )}
                      {item.status === 'added' && (
                        <Badge variant="success" className="gap-1">
                          <Plus className="size-3" /> Added in Target
                        </Badge>
                      )}
                      {item.status === 'removed' && (
                        <Badge variant="destructive" className="gap-1">
                          <Minus className="size-3" /> Missing in Target
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-ink-3">
                No secrets configured in either environment yet.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center border-line/30">
          <GitCompare className="mx-auto size-8 text-ink-3 mb-3" />
          <p className="text-sm text-ink-2">Select two environments above to view difference analysis.</p>
        </Card>
      )}
    </div>
  );
}
