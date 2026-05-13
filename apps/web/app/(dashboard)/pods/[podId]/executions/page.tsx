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

function duration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function ExecutionsPage() {
  const { podId } = useParams<{ podId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [workflowNames, setWorkflowNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
      const nameMap: Record<string, string> = {};
      for (const wf of wfs.workflows ?? []) nameMap[wf.id] = wf.name;
      setWorkflowNames(nameMap);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wsLoading) return;
    if (!activeWorkspace) { setLoading(false); return; }
    void load();
  }, [activeWorkspace, wsLoading, podId, getToken]);

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

  const filtered =
    statusFilter === 'all' ? executions : executions.filter((e) => e.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Executions</h1>
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
            {statusFilter === 'all' ? 'No executions yet' : `No ${statusFilter} executions`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            {statusFilter === 'all'
              ? 'Trigger a workflow to see execution history here.'
              : `There are no executions with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
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
                      onClick={(e) => handleCancel(ex, e)}
                    >
                      Cancel
                    </Button>
                  )}
                  {RERUNNABLE.has(ex.status) && ex.workflowId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actioning === ex.id}
                      onClick={(e) => handleRerun(ex, e)}
                    >
                      Re-run
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
