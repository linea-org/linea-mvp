'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon, Loading01Icon } from '@hugeicons/core-free-icons';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface PlanInfo {
  key: string;
  label: string;
  priceUsd: number;
  executions: string;
  workflows: string;
  members: string;
  features: string[];
}

interface PlansResponse {
  plans: PlanInfo[];
  currentPlan: string;
}

/* ─── Static catalogue (used as fallback if API is down) ────────────── */
const FALLBACK_PLANS: PlanInfo[] = [
  {
    key: 'pro', label: 'Pro', priceUsd: 29,
    executions: '10,000 / month', workflows: 'Unlimited', members: '10',
    features: ['Priority support', 'Advanced analytics', 'Custom domains'],
  },
  {
    key: 'team', label: 'Team', priceUsd: 99,
    executions: '100,000 / month', workflows: 'Unlimited', members: '25',
    features: ['SSO', 'Audit logs', 'Dedicated support', 'SLA guarantee'],
  },
];

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, team: 2, enterprise: 3 };

const PLAN_LIMITS: Record<string, { executions: string; workflows: string; members: string }> = {
  free:       { executions: '500 / month',     workflows: '5',         members: '3'         },
  pro:        { executions: '10,000 / month',  workflows: 'Unlimited', members: '10'        },
  team:       { executions: '100,000 / month', workflows: 'Unlimited', members: '25'        },
  enterprise: { executions: 'Unlimited',       workflows: 'Unlimited', members: 'Unlimited' },
};

/* ─── Component ─────────────────────────────────────────────────────── */
export default function BillingPage() {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const wsId = activeWorkspace?.id ?? '';

  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  /* Handle Polar success redirect */
  const successPlan = searchParams.get('success') === '1' ? (searchParams.get('plan') ?? 'paid') : null;
  useEffect(() => {
    if (successPlan) {
      /* Strip query params after showing success */
      const t = setTimeout(() => router.replace('/settings/billing'), 5000);
      return () => clearTimeout(t);
    }
  }, [successPlan, router]);

  const { data: plansData, isLoading } = useQuery<PlansResponse>({
    queryKey: ['billing-plans', wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const api = createApiClient(token);
      return api.get<PlansResponse>(`/workspaces/${wsId}/billing/plans`);
    },
  });

  if (!activeWorkspace) return null;

  const currentPlan = (plansData?.currentPlan ?? activeWorkspace.plan ?? 'free') as string;
  const limits = PLAN_LIMITS[currentPlan] ?? PLAN_LIMITS['free']!;

  const paidPlans: PlanInfo[] = isLoading
    ? []
    : (plansData?.plans ?? FALLBACK_PLANS).filter((p) => p.key !== 'free' && p.key !== 'enterprise');

  async function handleUpgrade(planKey: string) {
    if (!wsId) return;
    setPaying(planKey);
    setPayError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const api = createApiClient(token);
      const { url } = await api.post<{ url: string }>(`/workspaces/${wsId}/billing/checkout`, { plan: planKey });
      window.location.href = url;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Failed to start checkout');
      setPaying(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Success banner */}
      {successPlan && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <HugeiconsIcon icon={Tick01Icon} className="size-4 shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-medium text-green-400">Subscription activated!</p>
            <p className="text-xs text-green-500/80 mt-0.5">
              Your plan has been upgraded. It may take a moment to reflect.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {payError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {payError}
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Current plan</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-lg font-semibold capitalize">{currentPlan}</p>
              <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'} className="capitalize">
                {currentPlan}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Executions', value: limits.executions },
            { label: 'Workflows',  value: limits.workflows  },
            { label: 'Members',    value: limits.members    },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md bg-muted/50 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade plans */}
      {currentPlan !== 'enterprise' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Upgrade your plan</p>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-52 rounded-lg" />
              <Skeleton className="h-52 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paidPlans.map((p) => {
                const isCurrent = currentPlan === p.key;
                const isDowngrade = (PLAN_RANK[currentPlan] ?? 0) > (PLAN_RANK[p.key] ?? 0);

                return (
                  <div
                    key={p.key}
                    className={`rounded-xl border p-5 space-y-4 transition-colors ${
                      isCurrent
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{p.label}</p>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px]">Current</Badge>
                      )}
                    </div>

                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-bold">${p.priceUsd}</span>
                      <span className="text-xs text-muted-foreground pb-1">/ month</span>
                    </div>

                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-primary/60 shrink-0" />
                        {p.executions} executions
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-primary/60 shrink-0" />
                        {p.members} team members
                      </li>
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Tick01Icon} className="size-3 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isCurrent ? 'outline' : 'default'}
                      disabled={isCurrent || isDowngrade || paying !== null}
                      onClick={() => void handleUpgrade(p.key)}
                    >
                      {paying === p.key ? (
                        <>
                          <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin" />
                          Redirecting to Polar…
                        </>
                      ) : isCurrent ? (
                        'Current plan'
                      ) : isDowngrade ? (
                        'Contact us to downgrade'
                      ) : (
                        `Upgrade to ${p.label}`
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enterprise CTA */}
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
        <p className="text-sm font-semibold">Need Enterprise?</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Unlimited executions, SSO, audit logs, dedicated support, and custom SLAs.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="mailto:hello@getlinea.ai">Contact us</a>
        </Button>
      </div>

      {/* Powered by Polar */}
      <p className="text-center text-[10px] text-muted-foreground/50">
        Payments powered by{' '}
        <a href="https://polar.sh" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground">
          Polar.sh
        </a>
      </p>
    </div>
  );
}
