'use client';

import { useWorkspace } from '@/contexts/workspace-context';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';

const BILLING_ENABLED = process.env['NEXT_PUBLIC_BILLING_ENABLED'] === 'true';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  team: 'Team',
  enterprise: 'Enterprise',
};

const PLAN_LIMITS: Record<string, { executions: string; workflows: string; members: string }> = {
  free:       { executions: '500 / month',     workflows: '5',       members: '3' },
  pro:        { executions: '10,000 / month',  workflows: 'Unlimited', members: '10' },
  team:       { executions: '100,000 / month', workflows: 'Unlimited', members: '25' },
  enterprise: { executions: 'Unlimited',       workflows: 'Unlimited', members: 'Unlimited' },
};

export default function BillingPage() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) return null;

  const plan = activeWorkspace.plan ?? 'free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS['free']!;

  if (!BILLING_ENABLED) {
    return (
      <div className="space-y-6">
        {/* Current plan (read-only) */}
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

        {/* Coming soon */}
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="text-sm font-medium">Billing coming soon</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Subscription management and plan upgrades will be available in an upcoming release.
            Contact us if you need a higher plan right now.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="mailto:hello@getlinea.ai">Contact us</a>
          </Button>
        </div>
      </div>
    );
  }

  // Full billing UI (rendered only when NEXT_PUBLIC_BILLING_ENABLED=true)
  return (
    <div className="space-y-8">
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

      <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
        <p className="text-sm font-medium">Need more?</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Enterprise includes unlimited executions, SSO, audit logs, dedicated support, and custom SLAs.
        </p>
        <Button variant="outline" size="sm">Contact sales</Button>
      </div>
    </div>
  );
}
