'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceTokenSchema, type ServiceTokenInput, type ServiceTokenView, type ServiceTokenCreatedView } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  RefreshCw,
  ShieldOff,
  Eye,
  EyeOff,
  XCircle,
  Loader2,
  Clock,
  Activity,
  AlertTriangle,
} from 'lucide-react';

interface EnvironmentSummary {
  id: string;
  name: string;
  slug: string;
}

interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
}

function StatusBadge({ status }: { status: ServiceTokenView['status'] }): React.ReactNode {
  if (status === 'ACTIVE') return <Badge variant="live">ACTIVE</Badge>;
  if (status === 'EXPIRED') return <Badge variant="secondary">EXPIRED</Badge>;
  return <Badge variant="destructive">REVOKED</Badge>;
}

function OneTimeRevealBanner({
  token,
  onDismiss,
}: {
  token: string;
  onDismiss: () => void;
}): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-warning mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-warning">Copy this token now — it will never be shown again.</p>
          <p className="text-xs text-ink-3 mt-1">
            This is the only time the full service token will be displayed. Store it securely in a password manager or vault.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-7 text-ink-3 shrink-0" onClick={onDismiss}>
          <XCircle className="size-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-line/40 bg-black/40 px-3 py-2 font-mono text-xs text-peri-2 overflow-x-auto whitespace-nowrap">
          {visible ? token : token.slice(0, 8) + '•'.repeat(Math.max(0, token.length - 8))}
        </div>
        <Button variant="ghost" size="icon" className="size-9 text-ink-3 hover:text-ink shrink-0" onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button
          variant="default"
          size="sm"
          className="shrink-0"
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <>
              <Check className="mr-1.5 size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 size-3.5" /> Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ServiceTokensPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}): React.ReactNode {
  const { workspaceId, projectId } = use(params);
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<ServiceTokenView | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ServiceTokenView | null>(null);
  const [rotateExpiresInDays, setRotateExpiresInDays] = useState(30);

  const { data: project } = useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: () => apiClient.get<ProjectDetail>(`/workspaces/${workspaceId}/projects/${projectId}`),
  });

  const { data: environments, isLoading: envsLoading } = useQuery({
    queryKey: ['project-environments', workspaceId, projectId],
    queryFn: () => apiClient.get<EnvironmentSummary[]>(`/workspaces/${workspaceId}/projects/${projectId}/environments`),
  });

  const {
    data: tokens,
    isLoading: tokensLoading,
    isError: tokensError,
    refetch: refetchTokens,
  } = useQuery({
    queryKey: ['service-tokens', workspaceId, projectId],
    queryFn: () => apiClient.get<ServiceTokenView[]>(`/workspaces/${workspaceId}/projects/${projectId}/credentials`),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServiceTokenInput>({
    resolver: zodResolver(serviceTokenSchema),
    defaultValues: { expiresInDays: 30 },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/credentials/${tokenId}/revoke`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['service-tokens', workspaceId, projectId] });
      setRevokeTarget(null);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiClient.post<ServiceTokenCreatedView>(`/workspaces/${workspaceId}/projects/${projectId}/credentials/${tokenId}/rotate`, {
        expiresInDays: rotateExpiresInDays,
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['service-tokens', workspaceId, projectId] });
      setRotateTarget(null);
      setNewToken(data.token);
    },
  });

  const handleCreate = async (data: ServiceTokenInput): Promise<void> => {
    setCreateError(null);
    try {
      const created = await apiClient.post<ServiceTokenCreatedView>(
        `/workspaces/${workspaceId}/projects/${projectId}/credentials`,
        data
      );
      void queryClient.invalidateQueries({ queryKey: ['service-tokens', workspaceId, projectId] });
      reset();
      setCreateOpen(false);
      setNewToken(created.token);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create service token');
    }
  };

  if (tokensLoading || envsLoading) {
    return <LoadingState message="Loading service tokens..." />;
  }

  if (tokensError) {
    return (
      <ErrorState
        title="Failed to load service tokens"
        description="You may lack credentials.manage permission on this project."
        onRetry={() => void refetchTokens()}
      />
    );
  }

  const activeTokens = tokens?.filter((t) => t.status === 'ACTIVE') ?? [];
  const inactiveTokens = tokens?.filter((t) => t.status !== 'ACTIVE') ?? [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-ink">
              Service <span className="font-serif italic text-peri-2">Tokens</span>
            </h1>
            <Badge variant="live">CREDENTIALS</Badge>
          </div>
          <p className="text-sm text-ink-2 mt-1">
            Scoped API credentials for{' '}
            <span className="font-mono text-peri-2">{project?.name ?? projectId}</span>. Each token is bound to one environment and stored as a hash only.
          </p>
        </div>

        <Button variant="default" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> Create Token
        </Button>
      </div>

      {/* One-time reveal banner */}
      {newToken && (
        <OneTimeRevealBanner token={newToken} onDismiss={() => setNewToken(null)} />
      )}

      {/* Create Token Form */}
      {createOpen && (
        <Card className="border-peri/40 bg-violet-deep shadow-2xl">
          <CardHeader className="pb-3 border-b border-line/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-peri-2" />
                <CardTitle className="text-base font-medium text-ink">New Service Token</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => { setCreateOpen(false); setCreateError(null); reset(); }}>
                <XCircle className="size-4" />
              </Button>
            </div>
            <CardDescription className="text-ink-3 text-xs">
              Tokens have an <code className="font-mono">ags_</code> prefix, are scoped to one environment, and expire automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
              {createError && (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-1 space-y-2">
                  <Label className="text-xs font-mono uppercase text-ink-3">Token Name</Label>
                  <Input
                    placeholder="e.g. ci-deploy"
                    {...register('name')}
                    className="bg-black/20 border-line text-ink"
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase text-ink-3">Environment</Label>
                  <Select
                    onValueChange={(val) => setValue('environmentId', val)}
                  >
                    <SelectTrigger className="bg-black/20 border-line text-ink">
                      <SelectValue placeholder="Select environment" />
                    </SelectTrigger>
                    <SelectContent className="border-line/40 bg-popover text-ink">
                      {environments?.map((env) => (
                        <SelectItem key={env.id} value={env.id}>
                          {env.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.environmentId && <p className="text-xs text-destructive">{errors.environmentId.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase text-ink-3">Expires In (days)</Label>
                  <Select
                    defaultValue="30"
                    onValueChange={(val) => setValue('expiresInDays', parseInt(val, 10))}
                  >
                    <SelectTrigger className="bg-black/20 border-line text-ink">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-line/40 bg-popover text-ink">
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">365 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => { setCreateOpen(false); setCreateError(null); reset(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Creating...</>
                  ) : (
                    <><KeyRound className="mr-2 size-4" /> Generate Token</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Tokens', value: tokens?.length ?? 0, icon: KeyRound },
          { label: 'Active', value: activeTokens.length, icon: Activity },
          { label: 'Revoked / Expired', value: inactiveTokens.length, icon: ShieldOff },
          { label: 'Environments', value: environments?.length ?? 0, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-line/30 bg-black/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-ink-3 mb-1">
                <Icon className="size-3.5" />
                <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-2xl font-light text-ink">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Tokens Table */}
      {activeTokens.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-base font-medium text-ink">Active Tokens</h2>
          <Card className="border-line/40 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line/20 bg-black/40 font-mono text-[11px] tracking-wider uppercase text-ink-3">
                  <tr>
                    <th className="py-3 px-5 font-medium">Name</th>
                    <th className="py-3 px-5 font-medium">Prefix</th>
                    <th className="py-3 px-5 font-medium">Environment</th>
                    <th className="py-3 px-5 font-medium">Status</th>
                    <th className="py-3 px-5 font-medium">Last Used</th>
                    <th className="py-3 px-5 font-medium">Expires</th>
                    <th className="py-3 px-5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {activeTokens.map((token) => {
                    const env = environments?.find((e) => e.id === token.environmentId);
                    return (
                      <tr key={token.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="py-3.5 px-5 font-medium text-ink">{token.name}</td>
                        <td className="py-3.5 px-5">
                          <code className="rounded bg-peri/10 px-2 py-0.5 font-mono text-peri-2 border border-peri/20">
                            {token.tokenPrefix}…
                          </code>
                        </td>
                        <td className="py-3.5 px-5 font-mono text-ink-3">
                          {env?.name ?? token.environmentId.slice(-8)}
                        </td>
                        <td className="py-3.5 px-5">
                          <StatusBadge status={token.status} />
                        </td>
                        <td className="py-3.5 px-5 font-sans text-ink-3">
                          {token.lastUsedAt
                            ? new Date(token.lastUsedAt).toLocaleDateString()
                            : <span className="text-ink-3/50">Never</span>}
                        </td>
                        <td className="py-3.5 px-5 font-sans text-ink-3">
                          {new Date(token.expiresAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-ink-3 hover:text-peri-2"
                              onClick={() => setRotateTarget(token)}
                            >
                              <RefreshCw className="mr-1 size-3" /> Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-ink-3 hover:text-destructive"
                              onClick={() => setRevokeTarget(token)}
                            >
                              <ShieldOff className="mr-1 size-3" /> Revoke
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        !createOpen && (
          <EmptyState
            title="No active service tokens"
            description="Create a scoped token to authenticate CI pipelines and runtime environments."
            action={
              <Button variant="default" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" /> Create First Token
              </Button>
            }
          />
        )
      )}

      {/* Inactive Tokens — collapsed */}
      {inactiveTokens.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-medium text-ink-3">Revoked & Expired</h2>
          <Card className="border-line/20 shadow-2xl overflow-hidden opacity-60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line/20 bg-black/40 font-mono text-[11px] tracking-wider uppercase text-ink-3">
                  <tr>
                    <th className="py-3 px-5 font-medium">Name</th>
                    <th className="py-3 px-5 font-medium">Prefix</th>
                    <th className="py-3 px-5 font-medium">Status</th>
                    <th className="py-3 px-5 font-medium">Expired / Revoked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {inactiveTokens.map((token) => (
                    <tr key={token.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="py-3 px-5 text-ink-3">{token.name}</td>
                      <td className="py-3 px-5">
                        <code className="font-mono text-ink-3">{token.tokenPrefix}…</code>
                      </td>
                      <td className="py-3 px-5">
                        <StatusBadge status={token.status} />
                      </td>
                      <td className="py-3 px-5 font-sans text-ink-3">
                        {token.revokedAt
                          ? new Date(token.revokedAt).toLocaleDateString()
                          : new Date(token.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Rotate Confirmation Dialog */}
      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md border-peri/40 bg-violet-deep shadow-2xl mx-4">
            <CardHeader>
              <CardTitle className="text-lg font-medium text-ink flex items-center gap-2">
                <RefreshCw className="size-5 text-peri-2" />
                Rotate Token
              </CardTitle>
              <CardDescription className="text-ink-3 text-sm">
                Rotating <span className="font-mono text-peri-2">{rotateTarget.name}</span> will immediately invalidate the current token and generate a new one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-ink-3">New Expiry (days)</Label>
                <Select
                  defaultValue="30"
                  onValueChange={(val) => setRotateExpiresInDays(parseInt(val, 10))}
                >
                  <SelectTrigger className="bg-black/20 border-line text-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-line/40 bg-popover text-ink">
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">365 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setRotateTarget(null)}>Cancel</Button>
                <Button
                  onClick={() => rotateMutation.mutate(rotateTarget.id)}
                  disabled={rotateMutation.isPending}
                >
                  {rotateMutation.isPending ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Rotating...</>
                  ) : (
                    <><RefreshCw className="mr-2 size-4" /> Rotate Token</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      <ConfirmationDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        title={`Revoke token "${revokeTarget?.name ?? ''}"?`}
        description="The token will be immediately invalidated. Any process using it will fail authentication on the next request."
        confirmText="Revoke Token"
        destructive
        onConfirm={() => { if (revokeTarget) revokeMutation.mutate(revokeTarget.id); }}
      />
    </div>
  );
}
