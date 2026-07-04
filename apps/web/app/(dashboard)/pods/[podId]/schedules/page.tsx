"use client"

import { useCallback, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useApiClient } from "@/hooks/use-api-client"
import { unwrapList } from "@/lib/api"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useWorkspace } from "@/contexts/workspace-context"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { Label } from "@linea/ui/components/label"
import { Switch } from "@linea/ui/components/switch"
import { Badge } from "@linea/ui/components/badge"
import { Skeleton } from "@linea/ui/components/skeleton"
import { Separator } from "@linea/ui/components/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@linea/ui/components/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete01Icon,
  Calendar01Icon,
  Cancel01Icon,
  Edit01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@linea/ui/components/select"

interface Schedule {
  id: string
  workflowId: string
  cronExpr: string
  enabled: boolean
  input: Record<string, unknown>
  nextRunAt: string | null
  lastRunAt: string | null
  createdAt: string
}

interface Workflow {
  id: string
  name: string
}

interface InputPair {
  key: string
  value: string
}

interface FormState {
  workflowId: string
  cronExpr: string
}

const BLANK: FormState = { workflowId: "", cronExpr: "0 * * * *" }
const PAGE_SIZE = 10

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekdays at 9 AM", value: "0 9 * * 1-5" },
  { label: "Every Monday at 9AM", value: "0 9 * * 1" },
  { label: "Monthly on the 1st", value: "0 0 1 * *" },
]

function describeCron(expr: string): string {
  return CRON_PRESETS.find((p) => p.value === expr)?.label ?? ""
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  const absDiff = Math.abs(diff)
  if (absDiff < 60_000) return diff > 0 ? "in <1 min" : "just now"
  if (absDiff < 3_600_000) {
    const m = Math.round(absDiff / 60_000)
    return diff > 0 ? `in ${m}m` : `${m}m ago`
  }
  if (absDiff < 86_400_000) {
    const h = Math.round(absDiff / 3_600_000)
    return diff > 0 ? `in ${h}h` : `${h}h ago`
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SchedulesPage() {
  const { podId } = useParams<{ podId: string }>()
  const getApi = useApiClient()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const queryClient = useQueryClient()
  const wsId = activeWorkspace?.id ?? ""
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Schedule | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [inputPairs, setInputPairs] = useState<InputPair[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">(
    "all"
  )
  const [page, setPage] = useState(1)

  const { data: schedules = [], isLoading: loading } = useQuery<Schedule[]>({
    queryKey: ["schedules", wsId, podId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      const sched = await api.get<Schedule[]>(
        `/workspaces/${wsId}/pods/${podId}/schedules`
      )
      return Array.isArray(sched) ? sched : []
    },
  })

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ["workflows", wsId, podId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi()
      const result = await api.get<Workflow[] | { workflows: Workflow[] }>(
        `/workspaces/${wsId}/pods/${podId}/workflows`
      )
      return unwrapList(result, "workflows")
    },
  })

  function openCreate() {
    setEditTarget(null)
    setForm({ ...BLANK, workflowId: workflows[0]?.id ?? "" })
    setInputPairs([])
    setDialogOpen(true)
  }

  function openEdit(s: Schedule) {
    setEditTarget(s)
    setForm({ workflowId: s.workflowId, cronExpr: s.cronExpr })
    setInputPairs(
      Object.entries(s.input ?? {}).map(([key, value]) => ({
        key,
        value: String(value),
      }))
    )
    setDialogOpen(true)
  }

  const saveSchedule = useMutation({
    mutationFn: async () => {
      const api = await getApi()
      const base = `/workspaces/${wsId}/pods/${podId}/schedules`
      const input = Object.fromEntries(
        inputPairs
          .filter((p) => p.key.trim())
          .map((p) => [p.key.trim(), p.value])
      )
      if (editTarget) {
        return api.patch<Schedule>(`${base}/${editTarget.id}`, {
          cronExpr: form.cronExpr.trim(),
          input,
        })
      }
      if (!form.workflowId) throw new Error("No workflow selected")
      return api.post<Schedule>(base, {
        workflowId: form.workflowId,
        cronExpr: form.cronExpr.trim(),
        input,
        enabled: true,
      })
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Schedule[]>(
        ["schedules", wsId, podId],
        (prev = []) =>
          editTarget
            ? prev.map((s) => (s.id === result.id ? result : s))
            : [result, ...prev]
      )
      setDialogOpen(false)
    },
  })

  const toggleSchedule = useMutation({
    mutationFn: async (schedule: Schedule) => {
      const api = await getApi()
      return api.patch<Schedule>(
        `/workspaces/${wsId}/pods/${podId}/schedules/${schedule.id}`,
        { enabled: !schedule.enabled }
      )
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Schedule[]>(
        ["schedules", wsId, podId],
        (prev = []) => prev.map((s) => (s.id === updated.id ? updated : s))
      )
    },
  })

  const deleteSchedule = useMutation({
    mutationFn: async (schedule: Schedule) => {
      const api = await getApi()
      await api.delete(
        `/workspaces/${wsId}/pods/${podId}/schedules/${schedule.id}`
      )
      return schedule.id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Schedule[]>(
        ["schedules", wsId, podId],
        (prev = []) => prev.filter((s) => s.id !== id)
      )
      setDeleteConfirm(null)
    },
  })

  const workflowName = useCallback(
    (id: string) => {
      return workflows.find((w) => w.id === id)?.name ?? id.slice(0, 8) + "…"
    },
    [workflows]
  )

  const filtered = useMemo(() => {
    let list = schedules
    if (statusFilter !== "all") {
      list = list.filter((s) => s.enabled === (statusFilter === "active"))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        workflowName(s.workflowId).toLowerCase().includes(q)
      )
    }
    return list
  }, [schedules, workflows, statusFilter, search, workflowName])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Cron-based triggers for your workflows.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} />
          Add schedule
        </Button>
      </div>

      {!loading && !wsLoading && schedules.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by workflow name…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v as typeof statusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {loading || wsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HugeiconsIcon
            icon={Calendar01Icon}
            className="mx-auto mb-3 size-8 text-muted-foreground"
          />
          <p className="text-sm font-medium">No schedules yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Automate workflows with cron expressions.
          </p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            Add schedule
          </Button>
        </div>
      ) : filtered.length === 0 && schedules.length > 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No schedules match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-lg border p-4"
            >
              <Switch
                checked={s.enabled}
                disabled={
                  toggleSchedule.isPending &&
                  toggleSchedule.variables?.id === s.id
                }
                onCheckedChange={() => toggleSchedule.mutate(s)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {workflowName(s.workflowId)}
                  </p>
                  <Badge
                    variant={s.enabled ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {s.enabled ? "active" : "paused"}
                  </Badge>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-3">
                  <code className="font-mono text-xs text-muted-foreground">
                    {s.cronExpr}
                  </code>
                  {describeCron(s.cronExpr) && (
                    <span className="text-xs text-muted-foreground">
                      · {describeCron(s.cronExpr)}
                    </span>
                  )}
                  {s.enabled && s.nextRunAt && (
                    <span className="text-xs text-muted-foreground">
                      Next: {formatRelative(s.nextRunAt)}
                    </span>
                  )}
                  {s.lastRunAt && (
                    <span className="text-xs text-muted-foreground">
                      Last: {formatRelative(s.lastRunAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => openEdit(s)}
                >
                  <HugeiconsIcon icon={Edit01Icon} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  onClick={() => setDeleteConfirm(s)}
                >
                  <HugeiconsIcon icon={Delete01Icon} />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="px-2 text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit schedule" : "Add schedule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editTarget && (
              <div className="space-y-1.5">
                <Label>Workflow</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.workflowId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, workflowId: e.target.value }))
                  }
                >
                  <option value="">— select a workflow —</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Cron expression</Label>
              <Input
                value={form.cronExpr}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cronExpr: e.target.value }))
                }
                placeholder="0 * * * *"
                className="font-mono"
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, cronExpr: p.value }))
                    }
                    className="rounded-full border px-2 py-0.5 text-[11px] transition-colors hover:bg-muted"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Input fields (optional)</Label>
                <Button
                  size="xs"
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    setInputPairs((p) => [...p, { key: "", value: "" }])
                  }
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-3" />
                  Add field
                </Button>
              </div>
              {inputPairs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No input fields — the workflow will receive an empty input.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                    <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Key
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Value
                    </span>
                    <span />
                  </div>
                  {inputPairs.map((pair, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_1fr_auto] items-center gap-1"
                    >
                      <Input
                        value={pair.key}
                        onChange={(e) =>
                          setInputPairs((p) =>
                            p.map((r, j) =>
                              j === i ? { ...r, key: e.target.value } : r
                            )
                          )
                        }
                        placeholder="key"
                        className="h-8 font-mono text-xs"
                      />
                      <Input
                        value={pair.value}
                        onChange={(e) =>
                          setInputPairs((p) =>
                            p.map((r, j) =>
                              j === i ? { ...r, value: e.target.value } : r
                            )
                          )
                        }
                        placeholder="value"
                        className="h-8 text-xs"
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          setInputPairs((p) => p.filter((_, j) => j !== i))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveSchedule.mutate()}
              disabled={
                (!editTarget && !form.workflowId) ||
                !form.cronExpr.trim() ||
                saveSchedule.isPending
              }
            >
              {saveSchedule.isPending
                ? "Saving…"
                : editTarget
                  ? "Update"
                  : "Add schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schedule?</DialogTitle>
            <DialogDescription>
              The schedule for{" "}
              <strong>{workflowName(deleteConfirm?.workflowId ?? "")}</strong>{" "}
              will be permanently deleted. The workflow itself will not be
              affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteSchedule.isPending &&
                deleteSchedule.variables?.id === deleteConfirm?.id
              }
              onClick={() =>
                deleteConfirm && deleteSchedule.mutate(deleteConfirm)
              }
            >
              {deleteSchedule.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
