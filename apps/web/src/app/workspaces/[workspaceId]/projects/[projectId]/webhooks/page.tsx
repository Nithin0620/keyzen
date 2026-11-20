'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  webhookCreateSchema,
  webhookEventSchema,
  type WebhookCreateInput,
  type WebhookView,
  type WebhookCreatedView,
  type WebhookDeliveryView,
  type WebhookEvent,
} from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Webhook,
  Plus,
  RefreshCw,
  PowerOff,
  ChevronDown,
  ChevronRight,
  Loader2,
  XCircle,
  Check,
  Copy,
  AlertTriangle,
} from 'lucide-react';

const ALL_EVENTS = webhookEventSchema.options;

function DeliveryStatusBadge({ status }: { status: WebhookDeliveryView['status'] }): React.ReactNode {
  if (status === 'DELIVERED') return <Badge variant="success" className="font-mono text-[10px]">DELIVERED</Badge>;
  if (status === 'FAILED') return <Badge variant="destructive" className="font-mono text-[10px]">FAILED</Badge>;
  return <Badge variant="secondary" className="font-mono text-[10px]">PENDING</Badge>;
}

function SecretRevealBanner({ secret, onDismiss }: { secret: string; onDismiss: () => void }): React.ReactNode {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-warning mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-warning">Copy the signing secret — it won't be shown again.</p>
          <p className="text-xs text-ink-3 mt-1">
            Use this HMAC secret to verify that webhook payloads originate from Aegis. Store it securely.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-7 text-ink-3 shrink-0" onClick={onDismiss}>
          <XCircle className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-line/40 bg-black/40 px-3 py-2 font-mono text-xs text-peri-2 overflow-x-auto whitespace-nowrap">
          {secret}
        </div>
        <Button variant="default" size="sm" className="shrink-0" onClick={() => void handleCopy()}>
          {copied ? (
            <><Check className="mr-1.5 size-3.5" /> Copied</>
          ) : (
            <><Copy className="mr-1.5 size-3.5" /> Copy</>
          )}
        </Button>
      </div>
    </div>
  );
}

function DeliveriesPanel({ workspaceId, projectId, webhookId }: { workspaceId: string; projectId: string; webhookId: string }): React.ReactNode {
  const { data: deliveries, isLoading } = useQuery({
    queryKey: ['webhook-deliveries', workspaceId, projectId, webhookId],
    queryFn: () => apiClient.get<WebhookDeliveryView[]>(
      `/workspaces/${workspaceId}/projects/${projectId}/webhooks/${webhookId}/deliveries`
    ),
  });

  if (isLoading) return <div className="py-4 text-center text-xs text-ink-3 font-mono">Loading deliveries...</div>;

  if (!deliveries || deliveries.length === 0) {
    return <div className="py-4 text-center text-xs text-ink-3 font-mono">No delivery attempts yet.</div>;
  }

  return (
    <div className="rounded-lg border border-line/20 bg-black/30 overflow-hidden">
      <table className="w-full text-left text-xs font-mono">
        <thead className="border-b border-line/20 bg-black/30 text-[10px] uppercase tracking-wider text-ink-3">
          <tr>
            <th className="py-2 px-4 font-medium">Event</th>
            <th className="py-2 px-4 font-medium">Status</th>
            <th className="py-2 px-4 font-medium">HTTP</th>
            <th className="py-2 px-4 font-medium">Attempts</th>
            <th className="py-2 px-4 font-medium">Sent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/10">
          {deliveries.map((d) => (
            <tr key={d.id} className="hover:bg-white/[0.02]">
              <td className="py-2.5 px-4 text-peri-2">{d.event}</td>
              <td className="py-2.5 px-4"><DeliveryStatusBadge status={d.status} /></td>
              <td className="py-2.5 px-4 text-ink-3">{d.responseStatus ?? '—'}</td>
              <td className="py-2.5 px-4 text-ink-3">{d.attempts}</td>
              <td className="py-2.5 px-4 text-ink-3">{new Date(d.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function WebhooksPage({
  params,
}: {
  params: Promise<{ workspaceId: string; projectId: string }>;
}): React.ReactNode {
  const { workspaceId, projectId } = use(params);
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);

  const {
    data: webhooks,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['webhooks', workspaceId, projectId],
    queryFn: () => apiClient.get<WebhookView[]>(`/workspaces/${workspaceId}/projects/${projectId}/webhooks`),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WebhookCreateInput>({
    resolver: zodResolver(webhookCreateSchema),
    defaultValues: { events: [] },
  });

  const selectedEvents = watch('events') ?? [];

  const toggleEvent = (event: WebhookEvent): void => {
    const current = selectedEvents;
    if (current.includes(event)) {
      setValue('events', current.filter((e) => e !== event));
    } else {
      setValue('events', [...current, event]);
    }
  };

  const rotateMutation = useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.post<WebhookCreatedView>(
        `/workspaces/${workspaceId}/projects/${projectId}/webhooks/${webhookId}/rotate-secret`,
        {}
      ),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId, projectId] });
      setNewSecret(data.secret);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (webhookId: string) =>
      apiClient.delete(`/workspaces/${workspaceId}/projects/${projectId}/webhooks/${webhookId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId, projectId] });
    },
  });

  const handleCreate = async (data: WebhookCreateInput): Promise<void> => {
    setCreateError(null);
    try {
      const created = await apiClient.post<WebhookCreatedView>(
        `/workspaces/${workspaceId}/projects/${projectId}/webhooks`,
        data
      );
      void queryClient.invalidateQueries({ queryKey: ['webhooks', workspaceId, projectId] });
      reset();
      setCreateOpen(false);
      setNewSecret(created.secret);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create webhook');
    }
  };

  if (isLoading) return <LoadingState message="Loading webhooks..." />;

  if (isError) {
    return (
      <ErrorState
        title="Failed to load webhooks"
        description="You may lack webhooks.manage permission on this project."
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
              <span className="font-serif italic text-peri-2">Webhooks</span>
            </h1>
            <Badge variant="live">OUTBOUND</Badge>
          </div>
          <p className="text-sm text-ink-2 mt-1">
            Receive real-time HMAC-signed payloads when secrets or tokens change. All requests are made over HTTPS.
          </p>
        </div>
        <Button variant="default" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" /> Add Webhook
        </Button>
      </div>

      {/* Signing secret reveal banner */}
      {newSecret && (
        <SecretRevealBanner secret={newSecret} onDismiss={() => setNewSecret(null)} />
      )}

      {/* Create Webhook Form */}
      {createOpen && (
        <Card className="border-peri/40 bg-violet-deep shadow-2xl">
          <CardHeader className="pb-3 border-b border-line/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="size-4 text-peri-2" />
                <CardTitle className="text-base font-medium text-ink">New Webhook Endpoint</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => { setCreateOpen(false); setCreateError(null); reset(); }}
              >
                <XCircle className="size-4" />
              </Button>
            </div>
            <CardDescription className="text-ink-3 text-xs">
              Payloads are signed with HMAC-SHA256. Only HTTPS endpoints with routable IPs are accepted.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit(handleCreate)} className="space-y-5">
              {createError && (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase text-ink-3">Endpoint URL</Label>
                <Input
                  type="url"
                  placeholder="https://your-server.com/webhooks/aegis"
                  {...register('url')}
                  className="bg-black/20 border-line text-ink font-mono text-xs"
                />
                {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-mono uppercase text-ink-3">Events to Subscribe</Label>
                {errors.events && <p className="text-xs text-destructive">{errors.events.message}</p>}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ALL_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-line/30 bg-black/20 px-3 py-2.5 hover:border-peri/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedEvents.includes(event)}
                        onCheckedChange={() => toggleEvent(event)}
                        className="border-line/60"
                      />
                      <span className="font-mono text-xs text-ink">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setCreateOpen(false); setCreateError(null); reset(); }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 size-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Webhook className="mr-2 size-4" /> Create Webhook</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Webhooks List */}
      {webhooks && webhooks.length > 0 ? (
        <div className="space-y-3">
          {webhooks.map((wh) => {
            const isExpanded = expandedWebhookId === wh.id;
            return (
              <Card
                key={wh.id}
                className={`border-line/40 shadow-2xl transition-all ${!wh.isActive ? 'opacity-60' : ''}`}
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedWebhookId(isExpanded ? null : wh.id)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <code className="font-mono text-xs text-peri-2 break-all">{wh.url}</code>
                      {wh.isActive ? (
                        <Badge variant="live">ACTIVE</Badge>
                      ) : (
                        <Badge variant="secondary">INACTIVE</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {wh.events.map((event) => (
                        <span
                          key={event}
                          className="rounded bg-peri/10 px-1.5 py-0.5 font-mono text-[10px] text-peri-2 border border-peri/20"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {wh.isActive && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-ink-3 hover:text-peri-2"
                          onClick={(e) => { e.stopPropagation(); rotateMutation.mutate(wh.id); }}
                          disabled={rotateMutation.isPending}
                          title="Rotate signing secret"
                        >
                          {rotateMutation.isPending ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-ink-3 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate(wh.id); }}
                          disabled={deactivateMutation.isPending}
                          title="Deactivate webhook"
                        >
                          {deactivateMutation.isPending && deactivateMutation.variables === wh.id ? (
                            <Loader2 className="size-3.5 animate-spin text-destructive" />
                          ) : (
                            <PowerOff className="size-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-ink-3" />
                    ) : (
                      <ChevronRight className="size-4 text-ink-3" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-line/20 px-4 pb-4 pt-3 space-y-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                      Recent Deliveries
                    </p>
                    <DeliveriesPanel
                      workspaceId={workspaceId}
                      projectId={projectId}
                      webhookId={wh.id}
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        !createOpen && (
          <EmptyState
            title="No webhooks configured"
            description="Add a webhook to receive real-time event notifications from this project."
            action={
              <Button variant="default" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" /> Add First Webhook
              </Button>
            }
          />
        )
      )}
    </div>
  );
}
