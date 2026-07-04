"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@clerk/nextjs"
import { useWorkspace } from "@/contexts/workspace-context"
import { usePod } from "@/contexts/space-context"
import { createApiClient } from "@/lib/api"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Button } from "@linea/ui/components/button"
import { Separator } from "@linea/ui/components/separator"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AnalyticsUpIcon,
  WorkflowSquare01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import Link from "next/link"

type Period = "24h" | "7d" | "30d"

interface MetricsData {
  period: Period
  executions: {
    total: number
    byStatus: {
      completed: number
      failed: number
      running: number
      queued: number
      suspended: number
      cancelled: number
    }
    successRate: number | null
  }
  duration: {
    avgMs: number | null
    p50Ms: number | null
    p95Ms: number | null
  }
  tokens?: {
    totalInputTokens: number
    totalOutputTokens: number
    totalTokens: number
  }
  topWorkflows: Array<{
    workflowId: string
    name: string
    total: number
    completed: number
    failed: number
    successRate: number
  }>
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: "green" | "red"
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold tabular-nums ${
          accent === "green"
            ? "text-green-700"
            : accent === "red"
              ? "text-destructive"
              : ""
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const PERIODS: { label: string; value: Period }[] = [
  { label: "24h", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
]

function EmptyMetrics() {
  const { pods } = usePod()
  const firstPodId = pods[0]?.id

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
        <HugeiconsIcon
          icon={AnalyticsUpIcon}
          className="size-7 text-muted-foreground"
        />
      </div>
      <h2 className="text-base font-semibold">No executions yet</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Run a workflow to start seeing execution stats, success rates, and
        duration percentiles here.
      </p>
      {firstPodId ? (
        <Button asChild className="mt-5" size="sm">
          <Link href={`/pods/${firstPodId}/workflows`}>
            Go to workflows
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Link>
        </Button>
      ) : (
        <Button asChild className="mt-5" size="sm">
          <Link href="/pods">
            Create a pod
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}

export default function MetricsPage() {
  const { getToken } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [period, setPeriod] = useState<Period>("7d")
  const [data, setData] = useState<MetricsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (wsLoading || !activeWorkspace) return
    setLoading(true)
    setError(false)

    async function load() {
      const token = await getToken()
      if (!token || !activeWorkspace) return
      try {
        const api = createApiClient(token)
        const result = await api.get<MetricsData>(
          `/workspaces/${activeWorkspace.id}/metrics?period=${period}`
        )
        setData(result)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [activeWorkspace, wsLoading, period, getToken])

  const hasData = data && data.executions.total > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Execution statistics for this workspace
          </p>
        </div>
        <div className="flex gap-1.5 rounded-lg border p-1">
          {PERIODS.map(({ label, value }) => (
            <Button
              key={value}
              variant={period === value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setPeriod(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {loading || wsLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Failed to load metrics. Try refreshing.
          </p>
        </div>
      ) : !hasData ? (
        <EmptyMetrics />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total" value={data.executions.total} />
            <StatCard
              label="Completed"
              value={data.executions.byStatus.completed}
              accent="green"
            />
            <StatCard
              label="Failed"
              value={data.executions.byStatus.failed}
              accent={data.executions.byStatus.failed > 0 ? "red" : undefined}
            />
            <StatCard
              label="Success rate"
              value={
                data.executions.successRate !== null
                  ? `${data.executions.successRate}%`
                  : "—"
              }
              accent={
                data.executions.successRate !== null
                  ? data.executions.successRate >= 90
                    ? "green"
                    : data.executions.successRate < 70
                      ? "red"
                      : undefined
                  : undefined
              }
            />
            <StatCard
              label="Running / Queued"
              value={`${data.executions.byStatus.running} / ${data.executions.byStatus.queued}`}
            />
            <StatCard
              label="Suspended"
              value={data.executions.byStatus.suspended}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Avg duration"
              value={formatMs(data.duration.avgMs)}
            />
            <StatCard
              label="p50 duration"
              value={formatMs(data.duration.p50Ms)}
            />
            <StatCard
              label="p95 duration"
              value={formatMs(data.duration.p95Ms)}
            />
          </div>

          {data.tokens && data.tokens.totalTokens > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Input tokens"
                value={formatTokens(data.tokens.totalInputTokens)}
                sub="sent to model"
              />
              <StatCard
                label="Output tokens"
                value={formatTokens(data.tokens.totalOutputTokens)}
                sub="generated by model"
              />
              <StatCard
                label="Total tokens"
                value={formatTokens(data.tokens.totalTokens)}
                sub={`~$${((data.tokens.totalTokens / 1_000_000) * 3).toFixed(3)} est. cost`}
              />
            </div>
          )}

          {data.topWorkflows.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-3 text-sm font-medium">Top workflows</p>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                          Workflow
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                          Total
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                          Completed
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                          Failed
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                          Success rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.topWorkflows.map((wf) => (
                        <tr
                          key={wf.workflowId}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-2.5 font-medium">{wf.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {wf.total}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-700 tabular-nums">
                            {wf.completed}
                          </td>
                          <td className="px-4 py-2.5 text-right text-destructive tabular-nums">
                            {wf.failed}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span
                              className={
                                wf.successRate >= 90
                                  ? "text-green-700"
                                  : wf.successRate >= 70
                                    ? "text-yellow-600"
                                    : "text-destructive"
                              }
                            >
                              {wf.successRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {data.topWorkflows.length === 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <HugeiconsIcon
                icon={WorkflowSquare01Icon}
                className="size-4 shrink-0"
              />
              No workflow breakdown available for this period.
            </div>
          )}
        </>
      )}
    </div>
  )
}
