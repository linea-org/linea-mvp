'use client';

import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { usePod } from '@/contexts/space-context';
import { useApiClient } from '@/hooks/use-api-client';
import { formatRelativeTime, formatDurationShort } from '@/lib/format';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Button } from '@linea/ui/components/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  FlowCircleIcon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Loading01Icon,
  Analytics02Icon,
  AiChat01Icon,
  GridViewIcon,
  Add01Icon,
  Clock01Icon,
  AnalyticsUpIcon,
} from '@hugeicons/core-free-icons';

interface Execution {
  id: string;
  workflowId: string | null;
  status: string;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface Workflow { id: string; name: string; }

interface MetricsData {
  executions: {
    total: number;
    byStatus: { completed: number; failed: number; running: number; queued: number };
    successRate: number | null;
  };
  duration: { avgMs: number | null };
  topWorkflows: Array<{ workflowId: string; name: string; total: number; successRate: number }>;
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-green-600',
  failed: 'text-red-500',
  running: 'text-blue-500',
  queued: 'text-muted-foreground',
  suspended: 'text-amber-500',
  cancelled: 'text-muted-foreground',
};

function StatusDot({ status }: { status: string }) {
  if (status === 'completed') return <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5 text-green-500 shrink-0" />;
  if (status === 'failed') return <HugeiconsIcon icon={Cancel01Icon} className="size-3.5 text-red-500 shrink-0" />;
  if (status === 'running') return <HugeiconsIcon icon={Loading01Icon} className="size-3.5 text-blue-500 animate-spin shrink-0" />;
  return <span className="size-3.5 rounded-full border border-muted-foreground/30 shrink-0 inline-block" />;
}

export default function HomePage() {
  const getApi = useApiClient();
  const { user } = useUser();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const { activePod, loading: podLoading } = usePod();
  const wsId = activeWorkspace?.id ?? '';
  const podId = activePod?.id ?? '';

  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ['home-dashboard', wsId, podId],
    enabled: !!wsId && !!podId,
    queryFn: async () => {
      const api = await getApi();
      const [m, execList, wfList] = await Promise.all([
        api.get<MetricsData>(`/workspaces/${wsId}/metrics?period=24h`),
        api.get<Execution[] | { executions: Execution[] }>(`/workspaces/${wsId}/pods/${podId}/executions`),
        api.get<Workflow[] | { workflows: Workflow[] }>(`/workspaces/${wsId}/pods/${podId}/workflows`),
      ]);
      const executions = (Array.isArray(execList) ? execList : execList.executions).slice(0, 6);
      const workflows = Array.isArray(wfList) ? wfList : wfList.workflows;
      const workflowNames: Record<string, string> = {};
      for (const wf of workflows) workflowNames[wf.id] = wf.name;
      return { metrics: m, executions, workflowNames };
    },
  });

  const metrics = data?.metrics ?? null;
  const executions = data?.executions ?? [];
  const workflowNames = data?.workflowNames ?? {};
  const loading = wsLoading || podLoading || dataLoading;

  const firstName = user?.firstName ?? user?.username ?? 'there';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const podBase = activePod ? `/pods/${activePod.id}` : '/pods';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`${podBase}/workflows`}>
              <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
              New workflow
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/templates">
              <HugeiconsIcon icon={GridViewIcon} className="size-3.5" />
              Templates
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks">
              <HugeiconsIcon icon={AiChat01Icon} className="size-3.5" />
              AI Tasks
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {loading || wsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Runs today', value: metrics?.executions.total ?? 0, icon: FlowCircleIcon },
            {
              label: 'Success rate',
              value: metrics?.executions.successRate != null ? `${metrics.executions.successRate}%` : '—',
              icon: AnalyticsUpIcon,
            },
            { label: 'Failed', value: metrics?.executions.byStatus.failed ?? 0, icon: Cancel01Icon },
            { label: 'Avg duration', value: formatDurationShort(metrics?.duration.avgMs), icon: Clock01Icon },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <HugeiconsIcon icon={icon} className="size-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent runs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Recent runs</p>
          {activePod && (
            <Link
              href={`${podBase}/executions`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
            <HugeiconsIcon icon={FlowCircleIcon} className="size-7 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No runs yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {activePod ? 'Run a workflow to see activity.' : 'Select a pod to get started.'}
            </p>
            {activePod && (
              <Link
                href={`${podBase}/workflows`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
              >
                <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5" />
                Go to workflows
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border divide-y divide-border/50 overflow-hidden">
            {executions.map((ex) => {
              const wfName = (ex.workflowId && workflowNames[ex.workflowId]) ?? 'Unknown workflow';
              const dur = ex.startedAt && ex.finishedAt
                ? formatDurationShort(new Date(ex.finishedAt).getTime() - new Date(ex.startedAt).getTime())
                : null;
              return (
                <Link
                  key={ex.id}
                  href={`${podBase}/executions/${ex.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <StatusDot status={ex.status} />
                  <span className="flex-1 text-sm font-medium truncate">{wfName}</span>
                  <span className={`text-xs font-medium capitalize ${STATUS_COLOR[ex.status] ?? 'text-muted-foreground'}`}>
                    {ex.status}
                  </span>
                  {dur && <span className="text-xs text-muted-foreground tabular-nums">{dur}</span>}
                  <span className="text-xs text-muted-foreground/60 tabular-nums w-16 text-right shrink-0">
                    {formatRelativeTime(ex.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Top workflows */}
      {!loading && metrics && metrics.topWorkflows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Top workflows</p>
            <Link
              href="/metrics"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={Analytics02Icon} className="size-3" />
              Full metrics
            </Link>
          </div>
          <div className="rounded-xl border divide-y divide-border/50 overflow-hidden">
            {metrics.topWorkflows.slice(0, 5).map((wf) => (
              <div key={wf.workflowId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm truncate">{wf.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{wf.total} runs</span>
                <span className={`text-xs font-semibold tabular-nums w-10 text-right ${
                  wf.successRate >= 90 ? 'text-green-600' : wf.successRate >= 70 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {wf.successRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
