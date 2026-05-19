'use client';

import { useEffect, useState } from 'react';
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
} from '@linea/ui/components/dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Delete01Icon, Calendar01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

interface Schedule {
  id: string;
  workflowId: string;
  cronExpr: string;
  enabled: boolean;
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

const CRON_PRESETS = [
  { label: 'Every hour',    value: '0 * * * *' },
  { label: 'Every day',     value: '0 9 * * *' },
  { label: 'Every Monday',  value: '0 9 * * 1' },
  { label: 'Every 15 min',  value: '*/15 * * * *' },
];

export default function SchedulesPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK);
  const [inputPairs, setInputPairs] = useState<InputPair[]>([]);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  async function handleCreate() {
    if (!activeWorkspace || !form.workflowId || !form.cronExpr.trim()) return;
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const input = Object.fromEntries(
        inputPairs.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value]),
      );
      const created = await api.post<Schedule>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/schedules`,
        { workflowId: form.workflowId, cronExpr: form.cronExpr.trim(), input, enabled: true },
      );
      setSchedules((prev) => [created, ...prev]);
      setDialogOpen(false);
      setForm(BLANK);
      setInputPairs([]);
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
    } finally {
      setDeleting(null);
    }
  }

  function workflowName(id: string) {
    return workflows.find((w) => w.id === id)?.name ?? id.slice(0, 8) + '…';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Schedules</h1>
          <p className="text-sm text-muted-foreground">Cron-based triggers for your workflows.</p>
        </div>
        <Button size="sm" onClick={() => { setForm(BLANK); setInputPairs([]); setDialogOpen(true); }}>
          <HugeiconsIcon icon={Add01Icon} />
          Add schedule
        </Button>
      </div>

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
          <Button size="sm" className="mt-4" onClick={() => { setForm(BLANK); setInputPairs([]); setDialogOpen(true); }}>
            Add schedule
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
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
                <div className="flex items-center gap-3 mt-0.5">
                  <code className="text-xs text-muted-foreground font-mono">{s.cronExpr}</code>
                  {s.nextRunAt && (
                    <span className="text-xs text-muted-foreground">
                      Next: {new Date(s.nextRunAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="icon-sm"
                variant="destructive"
                disabled={deleting === s.id}
                onClick={() => void handleDelete(s)}
              >
                <HugeiconsIcon icon={Delete01Icon} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              onClick={() => void handleCreate()}
              disabled={!form.workflowId || !form.cronExpr.trim() || saving}
            >
              {saving ? 'Saving…' : 'Add schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
