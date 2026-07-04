"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useWorkspace } from "@/contexts/workspace-context"
import { useApiClient } from "@/hooks/use-api-client"
import { ApiError } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { Skeleton } from "@linea/ui/components/skeleton"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BookOpen01Icon,
  Search01Icon,
  ArrowDown01Icon,
  WorkflowSquare01Icon,
  FlowCircleIcon,
  Settings01Icon,
  UserMultiple02Icon,
  Key01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Add01Icon,
  Delete01Icon,
  Edit01Icon,
} from "@hugeicons/core-free-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"

interface AuditLog {
  id: string
  actorId: string
  actorEmail: string
  actorName: string | null
  action: string
  resourceType: string
  resourceId: string | null
  resourceName: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

type Period = "24h" | "7d" | "30d" | "all"

const PERIODS: { label: string; value: Period }[] = [
  { label: "24h", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "All time", value: "all" },
]

const RESOURCE_TYPES = [
  { label: "All resources", value: "all" },
  { label: "Workflow", value: "workflow" },
  { label: "Execution", value: "execution" },
  { label: "Pod", value: "pod" },
  { label: "Workspace", value: "workspace" },
  { label: "Member", value: "member" },
  { label: "API Key", value: "api_key" },
  { label: "Schedule", value: "schedule" },
  { label: "Webhook", value: "webhook" },
]

function actionIcon(action: string) {
  if (action.includes("create") || action.includes("add"))
    return { icon: Add01Icon, color: "text-green-500" }
  if (action.includes("delete") || action.includes("remove"))
    return { icon: Delete01Icon, color: "text-red-500" }
  if (
    action.includes("update") ||
    action.includes("edit") ||
    action.includes("patch")
  )
    return { icon: Edit01Icon, color: "text-blue-500" }
  if (action.includes("cancel") || action.includes("fail"))
    return { icon: Cancel01Icon, color: "text-red-500" }
  if (action.includes("complete") || action.includes("success"))
    return { icon: CheckmarkCircle01Icon, color: "text-green-500" }
  return { icon: BookOpen01Icon, color: "text-muted-foreground" }
}

function resourceIcon(type: string) {
  switch (type) {
    case "workflow":
      return WorkflowSquare01Icon
    case "execution":
      return FlowCircleIcon
    case "workspace":
      return Settings01Icon
    case "member":
      return UserMultiple02Icon
    case "api_key":
      return Key01Icon
    default:
      return BookOpen01Icon
  }
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function AuditPage() {
  const getApi = useApiClient()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const wsId = activeWorkspace?.id ?? ""
  const [period, setPeriod] = useState<Period>("7d")
  const [resourceType, setResourceType] = useState("all")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const {
    data: logs = [],
    isLoading: loading,
    error,
  } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs", wsId, period, resourceType],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      const params = new URLSearchParams()
      if (period !== "all") params.set("period", period)
      if (resourceType !== "all") params.set("resourceType", resourceType)
      return api.get<AuditLog[]>(
        `/workspaces/${wsId}/audit-logs?${params.toString()}`
      )
    },
  })

  const unavailable =
    error instanceof ApiError && (error.status === 404 || error.status === 501)

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      l.action.toLowerCase().includes(q) ||
      (l.actorEmail ?? "").toLowerCase().includes(q) ||
      (l.actorName ?? "").toLowerCase().includes(q) ||
      (l.resourceName ?? "").toLowerCase().includes(q) ||
      l.resourceType.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Track who changed what across your workspace
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs min-w-[180px] flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search actions, users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent pr-3 pl-8 text-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          />
        </div>

        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="h-9 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-0.5 rounded-lg border p-0.5">
          {PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                period === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(search || resourceType !== "all" || period !== "7d") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs"
            onClick={() => {
              setSearch("")
              setResourceType("all")
              setPeriod("7d")
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : unavailable ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              className="size-6 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">Audit log not available</p>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
            The audit log API endpoint is not yet implemented. Enable audit
            logging in your API configuration to start capturing events.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon
              icon={BookOpen01Icon}
              className="size-5 text-muted-foreground"
            />
          </div>
          <p className="text-sm font-medium">
            {search ? "No matching events" : "No audit events yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search
              ? "Try adjusting your search or filters."
              : "Workspace changes will be recorded here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </p>
          <div className="divide-y divide-border/50 overflow-hidden rounded-xl border">
            {filtered.map((log) => {
              const { icon: ActionIcon, color } = actionIcon(log.action)
              const ResIcon = resourceIcon(log.resourceType)
              const isExpanded = expanded === log.id
              const hasMetadata =
                log.metadata && Object.keys(log.metadata).length > 0

              return (
                <div key={log.id}>
                  <button
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 ${hasMetadata ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() =>
                      hasMetadata && setExpanded(isExpanded ? null : log.id)
                    }
                    disabled={!hasMetadata}
                  >
                    <span className={`shrink-0 ${color}`}>
                      <HugeiconsIcon icon={ActionIcon} className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">
                          {formatAction(log.action)}
                        </span>
                        {log.resourceName && (
                          <>
                            <span className="text-xs text-muted-foreground/40">
                              on
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <HugeiconsIcon
                                icon={ResIcon}
                                className="size-3"
                              />
                              {log.resourceName}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {log.actorName ?? log.actorEmail}
                        </span>
                        {log.actorName && (
                          <span className="text-xs text-muted-foreground/50">
                            {log.actorEmail}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs whitespace-nowrap text-muted-foreground">
                        {timeLabel(log.createdAt)}
                      </span>
                      {hasMetadata && (
                        <HugeiconsIcon
                          icon={ArrowDown01Icon}
                          className={`size-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      )}
                    </div>
                  </button>

                  {isExpanded && log.metadata && (
                    <div className="border-t bg-muted/20 px-4 py-3">
                      <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                        Details
                      </p>
                      <pre className="max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
