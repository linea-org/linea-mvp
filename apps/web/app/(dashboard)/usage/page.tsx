'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient, friendlyApiError } from '@/lib/api';
import { Skeleton } from '@linea/ui/components/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics02Icon,
  FlowCircleIcon,
  WorkflowSquare01Icon,
  ArrowRight01Icon,
  Invoice03Icon,
} from '@hugeicons/core-free-icons';

type Period = '24h' | '7d' | '30d';

interface MetricsData {
  executions: {
    total: number;
    byStatus: { completed: number; failed: number; running: number; queued: number };
    successRate: number | null;
  };
  tokens?: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
  };
  topWorkflows: Array<{
    workflowId: string;
    name: string;
    total: number;
    successRate: number;
    tokens?: { input: number; output: number; total: number };
  }>;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '24h', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
];

// Approximate blended cost per 1M tokens (Sonnet 4.6 pricing as baseline)
const INPUT_COST_PER_M = 3.0;
const OUTPUT_COST_PER_M = 15.0;

function calcCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_COST_PER_M + (output / 1_000_000) * OUTPUT_COST_PER_M;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(usd: number): string {
  if (usd < 0.001) return '<$0.001';
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function BigStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function TokenBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{formatTokens(value)}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function UsagePage() {
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [period, setPeriod] = useState<Period>('7d');
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (wsLoading || !activeWorkspace) return;
    setLoading(true);
    setLoadError(null);

    async function load() {
      const token = await getToken();
      if (!token || !activeWorkspace) return;
      try {
        const api = createApiClient(token);
        const result = await api.get<MetricsData>(
          `/workspaces/${activeWorkspace.id}/metrics?period=${period}`,
        );
        setData(result);
      } catch (err) {
        setData(null);
        setLoadError(friendlyApiError(err));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [activeWorkspace, wsLoading, period, getToken, retryCount]);

  const tokens = data?.tokens;
  const totalCost = tokens ? calcCost(tokens.totalInputTokens, tokens.totalOutputTokens) : null;
  const hasTokenData = tokens && tokens.totalTokens > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">Usage &amp; Cost</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Token consumption and estimated spend</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading || wsLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={Analytics02Icon} className="size-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Failed to load usage data</p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs">{loadError}</p>
          <button
            onClick={() => setRetryCount(c => c + 1)}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards — always shown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <BigStat
              label="Total tokens"
              value={hasTokenData ? formatTokens(tokens!.totalTokens) : '—'}
              sub={hasTokenData ? `${formatTokens(tokens!.totalInputTokens)} in + ${formatTokens(tokens!.totalOutputTokens)} out` : 'No AI agent executions yet'}
            />
            <BigStat
              label="Estimated cost"
              value={hasTokenData ? formatCost(totalCost!) : '—'}
              sub="Based on Sonnet 4.6 pricing"
            />
            <BigStat
              label="Executions"
              value={(data?.executions.total ?? 0).toLocaleString()}
              sub={data?.executions.successRate != null ? `${data.executions.successRate}% success rate` : 'No completed runs yet'}
            />
          </div>

          {/* Token breakdown — only when token data exists */}
          {hasTokenData && tokens ? (
            <>
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <p className="text-sm font-semibold">Token breakdown</p>
                <TokenBar label="Input tokens" value={tokens.totalInputTokens} max={tokens.totalTokens} color="bg-blue-500" />
                <TokenBar label="Output tokens" value={tokens.totalOutputTokens} max={tokens.totalTokens} color="bg-violet-500" />
                <div className="border-t pt-3 mt-2 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Input cost ({formatTokens(tokens.totalInputTokens)} × $3/1M)</span>
                    <span className="font-medium text-foreground">
                      {formatCost((tokens.totalInputTokens / 1_000_000) * INPUT_COST_PER_M)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output cost ({formatTokens(tokens.totalOutputTokens)} × $15/1M)</span>
                    <span className="font-medium text-foreground">
                      {formatCost((tokens.totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_M)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-medium text-foreground">
                    <span>Total estimated</span>
                    <span>{formatCost(totalCost!)}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
                <HugeiconsIcon icon={Invoice03Icon} className="size-3.5 mt-0.5 shrink-0" />
                <span>
                  Cost estimates use Claude Sonnet 4.6 pricing ($3/1M input, $15/1M output). Actual cost varies by model.
                  Haiku is ~20x cheaper; Opus is ~5x more expensive than Sonnet.
                </span>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed px-5 py-8 text-center">
              <HugeiconsIcon icon={Analytics02Icon} className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">No token usage yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Token usage is tracked when workflows with AI agent nodes are executed.
              </p>
            </div>
          )}

          {/* Per-workflow usage */}
          {(data?.topWorkflows?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">By workflow</p>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Workflow</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Runs</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Tokens</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Est. cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(data?.topWorkflows ?? []).map((wf) => {
                      const wfTokens = wf.tokens;
                      return (
                        <tr key={wf.workflowId} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium truncate max-w-[200px]">{wf.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {wf.total}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                            {wfTokens ? formatTokens(wfTokens.total) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {wfTokens
                              ? formatCost(calcCost(wfTokens.input, wfTokens.output))
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Per-workflow token breakdown requires token tracking in node results.
              </p>
            </div>
          )}

          {/* Link to full metrics */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <HugeiconsIcon icon={FlowCircleIcon} className="size-3.5" />
            <span>For execution counts, duration, and success rates, see</span>
            <Link href="/metrics" className="text-foreground hover:underline flex items-center gap-0.5">
              Metrics <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
