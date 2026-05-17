'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { FlowCircleIcon } from '@hugeicons/core-free-icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@linea/ui/components/table';

interface Execution {
  id: string;
  workflowId: string | null;
  status: string;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  input?: Record<string, unknown>;
}

interface Workflow {
  id: string;
  name: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  running: 'secondary',
  queued: 'outline',
  failed: 'destructive',
  cancelled: 'secondary',
  suspended: 'outline',
};

const CANCELLABLE = new Set(['queued', 'running', 'suspended']);
const RERUNNABLE = new Set(['completed', 'failed', 'cancelled']);

const DATE_FILTERS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
] as const;

function duration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function matchesDateFilter(createdAt: string, filter: string): boolean {
  if (filter === 'all') return true;
  const ts = new Date(createdAt).getTime();
  const now = Date.now();
  if (filter === 'today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return ts >= todayStart.getTime();
  }
  if (filter === '7d') return now - ts <= 7 * 24 * 60 * 60 * 1000;
  if (filter === '30d') return now - ts <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

export default function ExecutionsPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowNames, setWorkflowNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [actioning, setActioning] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const [data, wfs] = await Promise.all([
        api.get<{ executions: Execution[] }>(`/workspaces/${activeWorkspace.id}/pods/${podId}/executions`),
        api.get<{ workflows: Workflow[] }>(`/workspaces/${activeWorkspace.id}/pods/${podId}/workflows`),
      ]);
      setExecutions(data.executions);
      const wfList = wfs.workflows ?? [];
      setWorkflows(wfList);
      const nameMap: Record<string, string> = {};
      for (const wf of wfList) nameMap[wf.id] = wf.name;
      setWorkflowNames(nameMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading, podId, getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel(ex: Execution, e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeWorkspace) return;
    setActioning(ex.id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.delete(`/workspaces/${activeWorkspace.id}/pods/${podId}/executions/${ex.id}`);
      await load();
    } finally {
      setActioning(null);
    }
  }

  async function handleRerun(ex: Execution, e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeWorkspace || !ex.workflowId) return;
    setActioning(ex.id);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.post(`/workspaces/${activeWorkspace.id}/pods/${podId}/executions`, {
        workflowId: ex.workflowId,
        input: ex.input ?? {},
      });
      await load();
    } finally {
      setActioning(null);
    }
  }

  const filtered = executions.filter((ex) => {
    if (statusFilter !== 'all' && ex.status !== statusFilter) return false;
    if (workflowFilter !== 'all' && ex.workflowId !== workflowFilter) return false;
    if (!matchesDateFilter(ex.createdAt, dateFilter)) return false;
    return true;
  });

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (workflowFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Executions</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date filter pills */}
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setDateFilter(f.value)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  dateFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Workflow filter */}
          {workflows.length > 0 && (
            <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflows</SelectItem>
                {workflows.map((wf) => (
                  <SelectItem key={wf.id} value={wf.id}>{wf.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => { setStatusFilter('all'); setWorkflowFilter('all'); setDateFilter('all'); }}
            >
              Clear {activeFilterCount > 1 ? `${activeFilterCount} filters` : 'filter'}
            </Button>
          )}
        </div>
      </div>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={FlowCircleIcon} className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {activeFilterCount === 0 ? 'No executions yet' : 'No matching executions'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {activeFilterCount === 0
              ? 'Trigger a workflow to see execution history here.'
              : 'Try adjusting or clearing your filters.'}
          </p>
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 text-xs"
              onClick={() => { setStatusFilter('all'); setWorkflowFilter('all'); setDateFilter('all'); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} execution{filtered.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 ? ' matching filters' : ''}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Triggered by</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ex) => (
                <TableRow
                  key={ex.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/pods/${podId}/executions/${ex.id}`)}
                >
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ex.status] ?? 'secondary'}>{ex.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ex.workflowId ? (workflowNames[ex.workflowId] ?? ex.workflowId.slice(0, 8)) : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{ex.triggeredBy}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ex.startedAt ? new Date(ex.startedAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {duration(ex.startedAt, ex.finishedAt)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {CANCELLABLE.has(ex.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actioning === ex.id}
                        onClick={(e) => void handleCancel(ex, e)}
                      >
                        Cancel
                      </Button>
                    )}
                    {RERUNNABLE.has(ex.status) && ex.workflowId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actioning === ex.id}
                        onClick={(e) => void handleRerun(ex, e)}
                      >
                        Re-run
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
