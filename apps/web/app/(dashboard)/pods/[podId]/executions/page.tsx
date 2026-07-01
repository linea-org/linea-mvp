'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApiClient } from '@/hooks/use-api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/workspace-context';
import { formatDurationLong } from '@/lib/format';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Input } from '@linea/ui/components/input';
import { Skeleton } from '@linea/ui/components/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { FlowCircleIcon, Search01Icon, ReloadIcon } from '@hugeicons/core-free-icons';
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
  return formatDurationLong(ms) ?? '—';
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

const ACTIVE_STATUSES = new Set(['running', 'queued', 'suspended']);
const PAGE_SIZE = 20;

export default function ExecutionsPage() {
  const { podId } = useParams<{ podId: string }>();
  const getApi = useApiClient();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const wsId = activeWorkspace?.id ?? '';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const router = useRouter();

  const executionsKey = ['pod-executions', wsId, podId];

  const { data: executions = [], isLoading: loading, isFetching: refreshing } = useQuery<Execution[]>({
    queryKey: executionsKey,
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      const execList = await api.get<Execution[] | { executions: Execution[] }>(`/workspaces/${wsId}/pods/${podId}/executions`);
      return Array.isArray(execList) ? execList : (execList?.executions ?? []);
    },
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      return list.some((ex) => ACTIVE_STATUSES.has(ex.status)) ? 4_000 : false;
    },
  });

  const { data: workflows = [] } = useQuery<Workflow[]>({
    queryKey: ['pod-workflows-list', wsId, podId],
    enabled: !!wsId,
    queryFn: async () => {
      const api = await getApi();
      const wfArr = await api.get<Workflow[] | { workflows: Workflow[] }>(`/workspaces/${wsId}/pods/${podId}/workflows`);
      return Array.isArray(wfArr) ? wfArr : (wfArr?.workflows ?? []);
    },
  });

  const workflowNames = Object.fromEntries(workflows.map((wf) => [wf.id, wf.name]));

  const cancelExecution = useMutation({
    mutationFn: async (ex: Execution) => {
      const api = await getApi();
      await api.delete(`/workspaces/${wsId}/pods/${podId}/executions/${ex.id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: executionsKey }),
  });

  const rerunExecution = useMutation({
    mutationFn: async (ex: Execution) => {
      if (!ex.workflowId) throw new Error('No workflow for this execution');
      const api = await getApi();
      await api.post(`/workspaces/${wsId}/pods/${podId}/executions`, { workflowId: ex.workflowId, input: ex.input ?? {} });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: executionsKey }),
  });

  const searchLower = search.toLowerCase();
  const filtered = executions.filter((ex) => {
    if (statusFilter !== 'all' && ex.status !== statusFilter) return false;
    if (workflowFilter !== 'all' && ex.workflowId !== workflowFilter) return false;
    if (!matchesDateFilter(ex.createdAt, dateFilter)) return false;
    if (search) {
      const wfName = ex.workflowId ? (workflowNames[ex.workflowId] ?? '') : '';
      const matchesSearch = wfName.toLowerCase().includes(searchLower) ||
        ex.id.toLowerCase().includes(searchLower) ||
        ex.triggeredBy.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    return true;
  });

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (workflowFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0) +
    (search ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Executions</h1>
          {refreshing && <HugeiconsIcon icon={ReloadIcon} className="size-3.5 text-muted-foreground animate-spin" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 w-52 pl-8 text-xs"
              placeholder="Search workflows, IDs…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {/* Date filter pills */}
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setDateFilter(f.value); setPage(1); }}
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
            <Select value={workflowFilter} onValueChange={(v) => { setWorkflowFilter(v); setPage(1); }}>
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
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
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
              onClick={() => { setStatusFilter('all'); setWorkflowFilter('all'); setDateFilter('all'); setSearch(''); setPage(1); }}
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
              onClick={() => { setStatusFilter('all'); setWorkflowFilter('all'); setDateFilter('all'); setSearch(''); setPage(1); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
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
              {paginated.map((ex) => (
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
                        disabled={cancelExecution.isPending && cancelExecution.variables?.id === ex.id}
                        onClick={(e) => { e.stopPropagation(); cancelExecution.mutate(ex); }}
                      >
                        Cancel
                      </Button>
                    )}
                    {RERUNNABLE.has(ex.status) && ex.workflowId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={rerunExecution.isPending && rerunExecution.variables?.id === ex.id}
                        onClick={(e) => { e.stopPropagation(); rerunExecution.mutate(ex); }}
                      >
                        Re-run
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        </>
      )}
    </div>
  );
}
