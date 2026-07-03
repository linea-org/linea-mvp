"use client"

import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading01Icon,
  PlayIcon,
  ReloadIcon,
} from "@hugeicons/core-free-icons"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { ScrollArea } from "@linea/ui/components/scroll-area"

interface Execution {
  id: string
  status: string
  triggeredBy: string
  createdAt: string
  finishedAt: string | null
}

interface Log {
  id: string
  nodeId: string
  level: "info" | "error"
  data?: { output?: unknown; error?: string } | null
  durationMs?: number | null
  timestamp: string
}

interface Props {
  workspaceId: string
  podId: string
  workflowId: string
  token: string
  nodes: { id: string; data: Record<string, unknown> }[]
  onClose: () => void
}

const STATUS_COLOR: Record<string, string> = {
  completed: "text-green-600",
  failed: "text-red-500",
  running: "text-blue-500",
  queued: "text-muted-foreground",
  cancelled: "text-muted-foreground",
  suspended: "text-amber-500",
}

const STATUS_DOT: Record<string, string> = {
  completed: "bg-green-500",
  failed: "bg-red-500",
  running: "bg-blue-500 animate-pulse",
  queued: "bg-muted-foreground",
  cancelled: "bg-muted-foreground",
  suspended: "bg-amber-400",
}

export function HistoryPanel({
  workspaceId,
  podId,
  workflowId,
  token,
  nodes,
  onClose,
}: Props) {
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    void fetchExecutions()
  }, [])

  async function fetchExecutions() {
    setLoading(true)
    try {
      const api = createApiClient(token)
      const data = await api.get<{ executions: Execution[] }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions?workflowId=${workflowId}&limit=20`
      )
      setExecutions(data.executions)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function selectExecution(id: string) {
    setSelectedId(id)
    setLogs([])
    setLogsLoading(true)
    try {
      const api = createApiClient(token)
      const data = await api.get<Log[]>(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${id}/logs`
      )
      setLogs(data)
    } catch {
      // ignore
    } finally {
      setLogsLoading(false)
    }
  }

  function getNodeName(nodeId: string): string {
    const node = nodes.find((n) => n.id === nodeId)
    return (
      (node?.data?.nodeName as string) ??
      (node?.data?.label as string) ??
      nodeId
    )
  }

  function durationLabel(exec: Execution): string {
    if (!exec.finishedAt) return "—"
    const ms =
      new Date(exec.finishedAt).getTime() - new Date(exec.createdAt).getTime()
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Run History</p>
          <p className="text-[11px] text-muted-foreground">
            Past executions of this workflow
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void fetchExecutions()}
            title="Refresh"
          >
            <HugeiconsIcon icon={ReloadIcon} className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Execution list */}
        <div className="w-44 shrink-0 overflow-y-auto border-r border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-1.5 py-8 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={Loading01Icon}
                className="size-3 animate-spin"
              />
            </div>
          ) : executions.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No runs yet.
            </p>
          ) : (
            executions.map((ex) => (
              <button
                key={ex.id}
                onClick={() => void selectExecution(ex.id)}
                className={`w-full border-b border-border/50 px-2.5 py-2 text-left transition-colors hover:bg-muted/30 ${selectedId === ex.id ? "bg-muted/50" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[ex.status] ?? "bg-muted-foreground"}`}
                  />
                  <span
                    className={`text-[10px] font-semibold capitalize ${STATUS_COLOR[ex.status] ?? "text-muted-foreground"}`}
                  >
                    {ex.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(ex.createdAt).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {durationLabel(ex)}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Log detail */}
        <ScrollArea className="flex-1">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <HugeiconsIcon
                icon={PlayIcon}
                className="size-5 text-muted-foreground/40"
              />
              <p className="text-xs text-muted-foreground">
                Select a run to see its logs
              </p>
            </div>
          ) : logsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <HugeiconsIcon
                icon={Loading01Icon}
                className="size-3.5 animate-spin"
              />
            </div>
          ) : logs.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No log entries for this run.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {logs.map((log) => (
                <div key={log.id} className="space-y-1 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-foreground">
                      {getNodeName(log.nodeId)}
                    </span>
                    <div className="flex items-center gap-2">
                      {log.durationMs != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {log.durationMs}ms
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold ${log.level === "error" ? "text-red-500" : "text-green-600"}`}
                      >
                        {log.level === "error" ? "failed" : "ok"}
                      </span>
                    </div>
                  </div>
                  {(log.data?.output !== undefined || log.data?.error) && (
                    <pre className="max-h-24 overflow-y-auto rounded bg-muted/30 p-1.5 font-mono text-[10px] break-all whitespace-pre-wrap text-muted-foreground">
                      {log.data?.error
                        ? log.data.error
                        : typeof log.data?.output === "string"
                          ? log.data.output
                          : JSON.stringify(log.data?.output, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
