'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import {
  KeyRound,
  Plus,
  Search,
  Eye,
  EyeOff,
  History,
  Download,
  Upload,
  FolderGit2,
  Lock,
  Layers,
  Loader2,
} from 'lucide-react';
import type { ProjectSummary } from '../projects/page';
import type { EnvironmentSummary } from '../projects/[projectId]/page';

export interface SecretItemView {
  id: string;
  name: string;
  description?: string;
  value?: {
    present: boolean;
    masked: string | null;
  };
}

interface EnvExportResponse {
  entries: Array<{ name: string; value: string }>;
}

export default function WorkspaceSecretsVaultPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);
  const searchParams = useSearchParams();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('project') ?? '');
  const [selectedEnvId, setSelectedEnvId] = useState<string>(searchParams.get('env') ?? '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Reveal state map: secretId -> revealedPlaintext
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [revealingSecretId, setRevealingSecretId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Projects in workspace
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: () => apiClient.get<ProjectSummary[]>(`/workspaces/${workspaceId}/projects`),
  });

  // Auto-select an accessible project
  useEffect(() => {
    if (!projects) return;
    if (projects.length === 0) {
      if (selectedProjectId) {
        setSelectedProjectId('');
        setSelectedEnvId('');
      }
      return;
    }
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
      setSelectedEnvId('');
    }
  }, [projects, selectedProjectId]);

  // Environments for selected project
  const { data: environments, isLoading: envsLoading } = useQuery({
    queryKey: ['project-environments', workspaceId, selectedProjectId],
    queryFn: () =>
      apiClient.get<EnvironmentSummary[]>(
        `/workspaces/${workspaceId}/projects/${selectedProjectId}/environments`
      ),
    enabled: Boolean(selectedProjectId),
  });

  // Auto-select first environment if none in query
  useEffect(() => {
    if (environments && environments.length > 0) {
      if (!selectedEnvId || !environments.some((e) => e.id === selectedEnvId)) {
        setSelectedEnvId(environments[0].id);
      }
    } else {
      setSelectedEnvId('');
    }
  }, [environments, selectedEnvId]);

  // Secrets list
  const {
    data: secrets,
    isLoading: secretsLoading,
    isError: secretsError,
    refetch: refetchSecrets,
  } = useQuery({
    queryKey: ['secrets-list', workspaceId, selectedProjectId, selectedEnvId, searchQuery],
    queryFn: () =>
      apiClient.get<SecretItemView[]>(
        `/workspaces/${workspaceId}/projects/${selectedProjectId}/secrets`,
        {
          searchParams: {
            environmentId: selectedEnvId || undefined,
            query: searchQuery.trim() || undefined,
            limit: 100,
          },
        }
      ),
    enabled: Boolean(selectedProjectId && selectedEnvId),
  });

  // Reveal-on-demand with auto re-mask timer (30 seconds)
  const handleReveal = async (secretId: string): Promise<void> => {
    if (revealedSecrets[secretId]) {
      // Toggle off
      setRevealedSecrets((prev) => {
        const next = { ...prev };
        delete next[secretId];
        return next;
      });
      return;
    }

    if (!selectedEnvId) return;
    setRevealingSecretId(secretId);
    try {
      const res = await apiClient.get<{ value: string }>(
        `/workspaces/${workspaceId}/projects/${selectedProjectId}/secrets/${secretId}/reveal`,
        {
          searchParams: { environmentId: selectedEnvId },
        }
      );
      setRevealedSecrets((prev) => ({ ...prev, [secretId]: res.value }));

      // SECURITY: Auto re-mask after 30 seconds
      setTimeout(() => {
        setRevealedSecrets((prev) => {
          const next = { ...prev };
          delete next[secretId];
          return next;
        });
      }, 30_000);
    } catch {
      // Handled by global/toast error handling
    } finally {
      setRevealingSecretId(null);
    }
  };

  // Browser-side .env file export
  const handleExportEnv = async (): Promise<void> => {
    if (!selectedEnvId) return;
    setExporting(true);
    setExportError(null);
    try {
      const result = await apiClient.get<EnvExportResponse>(
        `/workspaces/${workspaceId}/projects/${selectedProjectId}/secrets/export`,
        {
          searchParams: { environmentId: selectedEnvId },
        }
      );
      const lines = result.entries.map((e) => `${e.name}=${e.value}`).join('\n');
      const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const envName = environments?.find((e) => e.id === selectedEnvId)?.slug ?? 'env';
      a.download = `.env.${envName}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Unable to export this environment.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-ink">
              Secrets <span className="font-serif italic text-peri-2">Vault</span>
            </h1>
            <Badge variant="live">ENCRYPTED AT REST</Badge>
          </div>
          <p className="text-sm text-ink-2">
            Values are masked by default. Audited on reveal, sealed with KMS envelope cryptography.
          </p>
        </div>

        {selectedProjectId && selectedEnvId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void handleExportEnv()} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin text-peri-2" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-1.5 size-3.5" /> Export .env
                </>
              )}
            </Button>
            <Link
              href={`/workspaces/${workspaceId}/secrets/import?project=${selectedProjectId}&env=${selectedEnvId}`}
            >
              <Button variant="ghost" size="sm">
                <Upload className="mr-1.5 size-3.5" /> Import .env
              </Button>
            </Link>
            <Link
              href={`/workspaces/${workspaceId}/secrets/new?project=${selectedProjectId}&env=${selectedEnvId}`}
            >
              <Button variant="default" size="sm">
                <Plus className="mr-1.5 size-3.5" /> New Secret
              </Button>
            </Link>
          </div>
        )}
      </div>

      {exportError && (
        <ErrorState
          title="Export failed"
          description={exportError}
          onRetry={() => void handleExportEnv()}
        />
      )}

      {/* Scope Filter Selectors */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Project Selector */}
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Project Scope
          </label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="bg-black/20 border-line text-ink">
              <SelectValue placeholder={projectsLoading ? 'Loading projects...' : 'Select project'} />
            </SelectTrigger>
            <SelectContent className="border-line/40 bg-popover text-ink">
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Environment Selector */}
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Environment Scope
          </label>
          <Select
            value={selectedEnvId}
            onValueChange={setSelectedEnvId}
            disabled={!selectedProjectId || envsLoading || !environments?.length}
          >
            <SelectTrigger className="bg-black/20 border-line text-ink">
              <SelectValue
                placeholder={
                  envsLoading
                    ? 'Loading environments...'
                    : !environments?.length
                    ? 'No environments configured'
                    : 'Select environment'
                }
              />
            </SelectTrigger>
            <SelectContent className="border-line/40 bg-popover text-ink">
              {environments?.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} (/{e.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Input */}
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-ink-3">
            Filter by Key
          </label>
          <div className="relative">
            <Search className="absolute top-2.5 left-3 size-4 text-ink-3" />
            <Input
              placeholder="e.g. STRIPE_SECRET_KEY"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/20 border-line pl-9 text-ink font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content / Vault Table */}
      {!selectedProjectId ? (
        <EmptyState
          title="Select a project"
          description="Choose a project from the selector above to access its secret vault."
          icon={FolderGit2}
        />
      ) : !selectedEnvId ? (
        <EmptyState
          title="No environments found"
          description="Create an environment for this project first to start storing secrets."
          action={
            <Link href={`/workspaces/${workspaceId}/projects/${selectedProjectId}/environments/new`}>
              <Button variant="default">
                <Plus className="mr-2 size-4" /> Create Environment
              </Button>
            </Link>
          }
          icon={Layers}
        />
      ) : secretsLoading ? (
        <LoadingState message="Decrypting vault metadata..." />
      ) : secretsError ? (
        <ErrorState
          title="Failed to load secrets"
          description="Could not access the secret vault. You might lack read permissions for this environment."
          onRetry={() => void refetchSecrets()}
        />
      ) : secrets && secrets.length > 0 ? (
        <Card className="border-line/40 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-line/20 bg-black/40 text-[11px] tracking-wider uppercase text-ink-3">
                <tr>
                  <th className="py-3 px-6 font-medium">Secret Name</th>
                  <th className="py-3 px-6 font-medium">Value (Masked Default)</th>
                  <th className="py-3 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {secrets.map((item) => {
                  const isRevealed = Boolean(revealedSecrets[item.id]);
                  const displayValue = isRevealed
                    ? revealedSecrets[item.id]
                    : item.value?.present
                    ? item.value.masked ?? '••••••••••••••••'
                    : '— (not set in this env)';

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="py-4 px-6 align-top">
                        <div className="flex items-center gap-2">
                          <Lock className="size-3.5 text-peri-2 shrink-0" />
                          <span className="font-semibold text-ink">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="mt-1 font-sans text-xs text-ink-3">{item.description}</p>
                        )}
                      </td>
                      <td className="py-4 px-6 align-top">
                        <div className="flex items-center gap-2">
                          <code
                            className={`rounded bg-black/30 px-2.5 py-1 text-xs border border-line/20 ${
                              isRevealed ? 'text-warning font-mono select-all' : 'text-ink-2'
                            }`}
                          >
                            {displayValue}
                          </code>
                          {item.value?.present && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-ink-3 hover:text-ink"
                              disabled={revealingSecretId === item.id}
                              onClick={() => void handleReveal(item.id)}
                              title={isRevealed ? 'Hide secret' : 'Reveal secret (audited)'}
                            >
                              {revealingSecretId === item.id ? (
                                <Loader2 className="size-3.5 animate-spin text-peri-2" />
                              ) : isRevealed ? (
                                <EyeOff className="size-3.5" />
                              ) : (
                                <Eye className="size-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 align-top text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/workspaces/${workspaceId}/secrets/${item.id}/history?project=${selectedProjectId}&env=${selectedEnvId}`}
                            title="Audit history & rollback"
                          >
                            <Button variant="ghost" size="icon" className="size-7 text-ink-3 hover:text-ink">
                              <History className="size-3.5" />
                            </Button>
                          </Link>
                          <Link
                            href={`/workspaces/${workspaceId}/secrets/${item.id}/edit?project=${selectedProjectId}&env=${selectedEnvId}`}
                            title="Edit secret value"
                          >
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-peri-2">
                              Update
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No secrets found"
          description={
            searchQuery
              ? `No secrets match "${searchQuery}".`
              : 'Add your first secret or API key to this environment.'
          }
          action={
            <Link
              href={`/workspaces/${workspaceId}/secrets/new?project=${selectedProjectId}&env=${selectedEnvId}`}
            >
              <Button variant="default">
                <Plus className="mr-2 size-4" /> Add Secret
              </Button>
            </Link>
          }
          icon={KeyRound}
        />
      )}
    </div>
  );
}
