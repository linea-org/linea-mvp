'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface PlanInfo {
  key: string;
  label: string;
  price: number;       // paise
  currency: string;
  executions: string;
  workflows: string;
  members: string;
  features: string[];
}

interface PlansResponse {
  plans: PlanInfo[];
  keyId: string;
  currentPlan: string;
}

interface OrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

/* ------------------------------------------------------------------ */
/*  Razorpay global type                                                */
/* ------------------------------------------------------------------ */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('razorpay-sdk')) { resolve(); return; }
    const s = document.createElement('script');
    s.id = 'razorpay-sdk';
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(s);
  });
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free', pro: 'Pro', team: 'Team', enterprise: 'Enterprise',
};

const PLAN_LIMITS: Record<string, { executions: string; workflows: string; members: string }> = {
  free:       { executions: '500 / month',     workflows: '5',         members: '3' },
  pro:        { executions: '10,000 / month',  workflows: 'Unlimited', members: '10' },
  team:       { executions: '100,000 / month', workflows: 'Unlimited', members: '25' },
  enterprise: { executions: 'Unlimited',       workflows: 'Unlimited', members: 'Unlimited' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function BillingPage() {
  const { getToken, userId } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const wsId = activeWorkspace?.id ?? '';

  const [paying, setPaying] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

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

  const plan = activeWorkspace.plan ?? 'free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS['free']!;

  async function handleUpgrade(planKey: string) {
    if (!wsId) return;
    setPaying(planKey);
    setPayError(null);
    setSuccess(null);
    try {
      await loadRazorpayScript();
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const api = createApiClient(token);

      const order = await api.post<OrderResponse>(`/workspaces/${wsId}/billing/order`, { plan: planKey });

      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: 'Linea',
          description: `${PLAN_LABEL[planKey] ?? planKey} plan`,
          prefill: {},
          theme: { color: '#6366f1' },
          handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              await api.post(`/workspaces/${wsId}/billing/verify`, {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                plan: planKey,
              });
              setSuccess(planKey);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rz.open();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      if (msg !== 'Payment cancelled') setPayError(msg);
    } finally {
      setPaying(null);
    }
  }

  const paidPlans: PlanInfo[] = isLoading
    ? []
    : (plansData?.plans ?? [
        {
          key: 'pro', label: 'Pro', price: 29900, currency: 'INR',
          executions: '10,000 / month', workflows: 'Unlimited', members: '10',
          features: ['Unlimited workflows', '10 team members', 'Priority support'],
        },
        {
          key: 'team', label: 'Team', price: 99900, currency: 'INR',
          executions: '100,000 / month', workflows: 'Unlimited', members: '25',
          features: ['Unlimited workflows', '25 team members', 'SSO', 'Audit logs'],
        },
      ]).filter((p) => p.key !== 'free' && p.key !== 'enterprise');

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Current plan</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-lg font-semibold">{PLAN_LABEL[plan] ?? plan}</p>
              <Badge variant={plan === 'free' ? 'secondary' : 'default'}>{PLAN_LABEL[plan] ?? plan}</Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Executions', value: limits.executions },
            { label: 'Workflows', value: limits.workflows },
            { label: 'Members', value: limits.members },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md bg-muted/50 px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          Upgraded to {PLAN_LABEL[success] ?? success}! Refresh the page to see your new limits.
        </div>
      )}
      {payError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {payError}
        </div>
      )}

      {/* Upgrade plans */}
      {plan !== 'enterprise' && (
        <div>
          <p className="text-sm font-semibold mb-3">Upgrade your plan</p>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-52 rounded-lg" />
              <Skeleton className="h-52 rounded-lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paidPlans.map((p) => {
                const isCurrent = plan === p.key;
                const isDowngrade = ['pro', 'team', 'enterprise'].indexOf(plan) > ['pro', 'team', 'enterprise'].indexOf(p.key);
                const priceDisplay = `₹${((p.price ?? 0) / 100).toLocaleString('en-IN')}`;

                return (
                  <div
                    key={p.key}
                    className={`rounded-lg border p-5 space-y-4 ${isCurrent ? 'border-primary/50 bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{p.label}</p>
                      {isCurrent && <Badge variant="default">Current</Badge>}
                    </div>
                    <div>
                      <span className="text-2xl font-bold">{priceDisplay}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ month</span>
                    </div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>{p.executions} executions</li>
                      <li>{p.members} team members</li>
                      {(p.features ?? []).map((f) => <li key={f}>{f}</li>)}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isCurrent ? 'outline' : 'default'}
                      disabled={isCurrent || isDowngrade || paying !== null}
                      onClick={() => void handleUpgrade(p.key)}
                    >
                      {paying === p.key ? 'Processing…' : isCurrent ? 'Current plan' : isDowngrade ? 'Downgrade not supported' : `Upgrade to ${p.label}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enterprise CTA */}
      <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
        <p className="text-sm font-medium">Need Enterprise?</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Unlimited executions, SSO, audit logs, dedicated support, and custom SLAs.
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="mailto:hello@getlinea.ai">Contact us</a>
        </Button>
      </div>
    </div>
  );
}
