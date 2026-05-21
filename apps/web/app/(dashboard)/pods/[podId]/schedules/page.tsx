'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Label } from '@linea/ui/components/label';
import { Switch } from '@linea/ui/components/switch';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Separator } from '@linea/ui/components/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, Calendar01Icon, Cancel01Icon, Edit01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';

interface Schedule {
  id: string;
  workflowId: string;
  cronExpr: string;
  enabled: boolean;
  input: Record<string, unknown>;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

interface Workflow {
  id: string;
  name: string;
}

interface InputPair { key: string; value: string }

interface FormState {
  workflowId: string;
  cronExpr: string;
}

const BLANK: FormState = { workflowId: '', cronExpr: '0 * * * *' };
const PAGE_SIZE = 10;

const CRON_PRESETS = [
  { label: 'Every minute',        value: '* * * * *'    },
  { label: 'Every 5 minutes',     value: '*/5 * * * *'  },
  { label: 'Every 15 minutes',    value: '*/15 * * * *' },
  { label: 'Every 30 minutes',    value: '*/30 * * * *' },
  { label: 'Every hour',          value: '0 * * * *'    },
  { label: 'Every 6 hours',       value: '0 */6 * * *'  },
  { label: 'Daily at midnight',   value: '0 0 * * *'    },
  { label: 'Daily at 9 AM',       value: '0 9 * * *'    },
  { label: 'Weekdays at 9 AM',    value: '0 9 * * 1-5'  },
  { label: 'Every Monday at 9AM', value: '0 9 * * 1'    },
  { label: 'Monthly on the 1st',  value: '0 0 1 * *'    },
];

function describeCron(expr: string): string {
  return CRON_PRESETS.find((p) => p.value === expr)?.label ?? '';
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = d.getTime() - Date.now();
  const absDiff = Math.abs(diff);
  if (absDiff < 60_000) return diff > 0 ? 'in <1 min' : 'just now';
  if (absDiff < 3_600_000) {
    const m = Math.round(absDiff / 60_000);
    return diff > 0 ? `in ${m}m` : `${m}m ago`;
  }
  if (absDiff < 86_400_000) {
    const h = Math.round(absDiff / 3_600_000);
    return diff > 0 ? `in ${h}h` : `${h}h ago`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SchedulesPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [inputPairs, setInputPairs] = useState<InputPair[]>([]);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [page, setPage] = useState(1);

  async function load() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const base = `/workspaces/${activeWorkspace.id}/pods/${podId}`;
      const [sched, wfsResult] = await Promise.all([
        api.get<Schedule[]>(`${base}/schedules`),
        api.get<Workflow[]>(`${base}/workflows`),
      ]);
      setSchedules(Array.isArray(sched) ? sched : []);
      setWorkflows(Array.isArray(wfsResult) ? wfsResult : ((wfsResult as any)?.workflows ?? []));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading, podId]);

  function openCreate() {
    setEditTarget(null);
    setForm({ ...BLANK, workflowId: workflows[0]?.id ?? '' });
    setInputPairs([]);
    setDialogOpen(true);
  }

  function openEdit(s: Schedule) {
    setEditTarget(s);
    setForm({ workflowId: s.workflowId, cronExpr: s.cronExpr });
    setInputPairs(Object.entries(s.input ?? {}).map(([key, value]) => ({ key, value: String(value) })));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!activeWorkspace || !form.cronExpr.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const base = `/workspaces/${activeWorkspace.id}/pods/${podId}/schedules`;
      const input = Object.fromEntries(
        inputPairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
      );
      if (editTarget) {
        const updated = await api.patch<Schedule>(`${base}/${editTarget.id}`, {
          cronExpr: form.cronExpr.trim(),
          input,
        });
        setSchedules((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      } else {
        if (!form.workflowId) return;
        const created = await api.post<Schedule>(base, {
          workflowId: form.workflowId,
          cronExpr: form.cronExpr.trim(),
          input,
          enabled: true,
        });
        setSchedules((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(schedule: Schedule) {
    if (!activeWorkspace) return;
    setToggling(schedule.id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const updated = await api.patch<Schedule>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/schedules/${schedule.id}`,
        { enabled: !schedule.enabled },
      );
      setSchedules((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(schedule: Schedule) {
    if (!activeWorkspace) return;
    setDeleting(schedule.id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/pods/${podId}/schedules/${schedule.id}`);
      setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
      setDeleteConfirm(null);
    } finally {
      setDeleting(null);
    }
  }

  function workflowName(id: string) {
    return workflows.find((w) => w.id === id)?.name ?? id.slice(0, 8) + '…';
  }

  const filtered = useMemo(() => {
    let list = schedules;
    if (statusFilter !== 'all') {
      list = list.filter((s) => s.enabled === (statusFilter === 'active'));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => workflowName(s.workflowId).toLowerCase().includes(q));
    }
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, workflows, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground">Cron-based triggers for your workflows.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} />
          Add schedule
        </Button>
      </div>

      {/* Search + filter bar */}
      {!loading && !wsLoading && schedules.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
            />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by workflow name…"
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setPage(1); }}>
            <SelectTrigger className="h-8 text-sm w-36">
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
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <HugeiconsIcon icon={Calendar01Icon} className="mx-auto mb-3 size-8 text-muted-foreground" />
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
          <p className="text-sm text-muted-foreground">No schedules match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-lg border p-4">
              <Switch
                checked={s.enabled}
                disabled={toggling === s.id}
                onCheckedChange={() => void handleToggle(s)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{workflowName(s.workflowId)}</p>
                  <Badge variant={s.enabled ? 'default' : 'outline'} className="text-[10px]">
                    {s.enabled ? 'active' : 'paused'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <code className="text-xs text-muted-foreground font-mono">{s.cronExpr}</code>
                  {describeCron(s.cronExpr) && (
                    <span className="text-xs text-muted-foreground">· {describeCron(s.cronExpr)}</span>
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
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon-sm" variant="ghost" onClick={() => openEdit(s)}>
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
          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="px-2 text-xs text-muted-foreground">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
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
            <DialogTitle>{editTarget ? 'Edit schedule' : 'Add schedule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editTarget && (
              <div className="space-y-1.5">
                <Label>Workflow</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.workflowId}
                  onChange={(e) => setForm((f) => ({ ...f, workflowId: e.target.value }))}
                >
                  <option value="">— select a workflow —</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Cron expression</Label>
              <Input
                value={form.cronExpr}
                onChange={(e) => setForm((f) => ({ ...f, cronExpr: e.target.value }))}
                placeholder="0 * * * *"
                className="font-mono"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, cronExpr: p.value }))}
                    className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted transition-colors"
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
                  onClick={() => setInputPairs((p) => [...p, { key: '', value: '' }])}
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
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Key</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Value</span>
                    <span />
                  </div>
                  {inputPairs.map((pair, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-1">
                      <Input
                        value={pair.key}
                        onChange={(e) => setInputPairs((p) => p.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                        placeholder="key"
                        className="font-mono text-xs h-8"
                      />
                      <Input
                        value={pair.value}
                        onChange={(e) => setInputPairs((p) => p.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                        placeholder="value"
                        className="text-xs h-8"
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        type="button"
                        onClick={() => setInputPairs((p) => p.filter((_, j) => j !== i))}
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              disabled={(!editTarget && !form.workflowId) || !form.cronExpr.trim() || saving}
            >
              {saving ? 'Saving…' : editTarget ? 'Update' : 'Add schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete schedule?</DialogTitle>
            <DialogDescription>
              The schedule for <strong>{workflowName(deleteConfirm?.workflowId ?? '')}</strong> will
              be permanently deleted. The workflow itself will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleting === deleteConfirm?.id}
              onClick={() => deleteConfirm && void handleDelete(deleteConfirm)}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
