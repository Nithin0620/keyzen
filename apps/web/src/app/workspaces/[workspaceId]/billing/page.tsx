'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BillingView } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  CreditCard,
  CheckCircle,
  Zap,
  Building2,
  Loader2,
  ExternalLink,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

function PlanBadge({ plan }: { plan: BillingView['plan'] }): React.ReactNode {
  if (plan === 'PRO') return <Badge variant="live" className="gap-1"><Zap className="size-3" /> PRO</Badge>;
  if (plan === 'ENTERPRISE') return <Badge className="gap-1 bg-peri/20 text-peri-2 border-peri/30"><Building2 className="size-3" /> ENTERPRISE</Badge>;
  return <Badge variant="outline" className="font-mono text-ink-3">FREE</Badge>;
}

function StatusBadge({ status }: { status: BillingView['status'] }): React.ReactNode {
  if (status === 'ACTIVE') return <Badge variant="success">ACTIVE</Badge>;
  if (status === 'PAST_DUE') return <Badge variant="destructive">PAST DUE</Badge>;
  return <Badge variant="secondary">CANCELED</Badge>;
}

interface PlanConfig {
  id: 'FREE' | 'PRO' | 'ENTERPRISE';
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight: boolean;
  checkoutPlan?: 'PRO' | 'ENTERPRISE';
}

const PLANS: PlanConfig[] = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    description: 'For individuals and small teams exploring secrets management.',
    features: [
      '1 workspace',
      '3 projects',
      '50 secrets',
      'Basic audit log (7-day retention)',
      'SDK + CLI access',
    ],
    highlight: false,
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$29 / mo',
    description: 'For growing teams with production secrets and compliance needs.',
    features: [
      'Unlimited projects',
      '5,000 secrets',
      'Full audit log (90-day retention)',
      'Webhook integrations',
      'Key rotation',
      'Priority support',
    ],
    highlight: true,
    checkoutPlan: 'PRO',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations needing SLAs, SSO and custom retention.',
    features: [
      'Everything in Pro',
      'Custom retention policy',
      'SAML / SSO',
      'AWS KMS / GCP KMS support',
      'SOC 2 attestation',
      'Dedicated SLA',
    ],
    highlight: false,
    checkoutPlan: 'ENTERPRISE',
  },
];

export default function BillingPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutPending, setCheckoutPending] = useState<'PRO' | 'ENTERPRISE' | null>(null);

  const {
    data: billing,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['billing', workspaceId],
    queryFn: () => apiClient.get<BillingView>(`/workspaces/${workspaceId}/billing`),
  });

  const handleCheckout = async (plan: 'PRO' | 'ENTERPRISE'): Promise<void> => {
    setCheckoutError(null);
    setCheckoutPending(plan);
    try {
      const { url } = await apiClient.post<{ sessionId: string; url: string }>(
        `/workspaces/${workspaceId}/billing/checkout`,
        { plan }
      );
      // Redirect to Stripe Checkout — server never writes plan state directly
      window.location.href = url;
    } catch (err: unknown) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not create checkout session');
      setCheckoutPending(null);
    }
  };

  if (isLoading) return <LoadingState message="Loading billing information..." />;

  if (isError) {
    return (
      <ErrorState
        title="Billing unavailable"
        description="You may lack billing.manage permission or Stripe is not configured."
        onRetry={() => void refetch()}
      />
    );
  }

  const currentPlan = billing?.plan ?? 'FREE';
  const isActive = billing?.status === 'ACTIVE';
  const isPastDue = billing?.status === 'PAST_DUE';

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-ink">
              <span className="font-serif italic text-peri-2">Billing</span> & Plans
            </h1>
            <PlanBadge plan={currentPlan} />
          </div>
          <p className="text-sm text-ink-2 mt-1">
            Manage your subscription. Billing state changes only via verified Stripe webhooks.
          </p>
        </div>
      </div>

      {/* Errors */}
      {checkoutError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{checkoutError}</AlertDescription>
        </Alert>
      )}

      {/* Current Subscription Status */}
      {billing && currentPlan !== 'FREE' && (
        <Card className="border-line/40 shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <CreditCard className="size-5 text-peri-2" />
              <CardTitle className="text-lg font-medium text-ink">Current Subscription</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3 mb-1">Plan</p>
                <PlanBadge plan={currentPlan} />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3 mb-1">Status</p>
                <StatusBadge status={billing.status} />
              </div>
              {billing.currentPeriodEnd && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3 mb-1">
                    <Clock className="inline size-3 mr-1" />Period Ends
                  </p>
                  <p className="font-mono text-xs text-ink">
                    {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              )}
              {billing.stripeCustomerId && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-3 mb-1">Customer ID</p>
                  <p className="font-mono text-xs text-ink-3 truncate">{billing.stripeCustomerId.slice(-16)}</p>
                </div>
              )}
            </div>

            {isPastDue && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-3">
                <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Payment past due</p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    Update your payment method to prevent service interruption. Your secrets remain accessible until the grace period ends.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-ink">Available Plans</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id && isActive;
            const isPending = checkoutPending === plan.checkoutPlan;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col border-line/40 shadow-2xl transition-all duration-200 ${
                  plan.highlight
                    ? 'border-peri/50 bg-gradient-to-b from-peri/10 to-transparent shadow-peri-glow/30'
                    : ''
                } ${isCurrent ? 'ring-1 ring-peri/40' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full border border-peri/40 bg-peri/20 px-3 py-0.5 font-mono text-[10px] uppercase tracking-wider text-peri-2">
                      <Sparkles className="inline size-2.5 mr-1" />Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl font-medium text-ink">{plan.name}</CardTitle>
                      <p className="text-2xl font-light text-peri-2 mt-1">{plan.price}</p>
                    </div>
                    {isCurrent && (
                      <Badge variant="success" className="gap-1 shrink-0">
                        <CheckCircle className="size-3" /> Current
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-ink-3 text-xs mt-2">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-ink-2">
                        <CheckCircle className="size-3.5 text-peri-2 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4 border-t border-line/20">
                  {plan.checkoutPlan ? (
                    isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="mr-2 size-4" /> Subscribed
                      </Button>
                    ) : (
                      <Button
                        variant={plan.highlight ? 'default' : 'outline'}
                        className="w-full"
                        onClick={() => void handleCheckout(plan.checkoutPlan!)}
                        disabled={checkoutPending !== null}
                      >
                        {isPending ? (
                          <><Loader2 className="mr-2 size-4 animate-spin" /> Redirecting...</>
                        ) : (
                          <><ExternalLink className="mr-2 size-4" /> Upgrade to {plan.name}</>
                        )}
                      </Button>
                    )
                  ) : isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle className="mr-2 size-4" /> Current Plan
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Free Tier
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing notice */}
      <p className="text-xs text-ink-3/60 font-mono text-center">
        Subscription changes are processed by Stripe. Aegis never stores card details. Plan state updates only on receipt of verified webhook events.
      </p>
    </div>
  );
}
