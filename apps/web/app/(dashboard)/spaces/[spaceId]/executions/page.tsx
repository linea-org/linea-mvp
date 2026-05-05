'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
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
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  running: 'secondary',
  queued: 'outline',
  failed: 'destructive',
  cancelled: 'secondary',
  suspended: 'outline',
};

function duration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const ms = new Date(end ?? Date.now()).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export default function ExecutionsPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (wsLoading || !activeWorkspace) return;

    async function load() {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const data = await api.get<{ executions: Execution[] }>(
          `/workspaces/${activeWorkspace!.id}/spaces/${spaceId}/executions`,
        );
        setExecutions(data.executions);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [activeWorkspace, wsLoading, spaceId, getToken]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Executions</h1>

      {loading || wsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : executions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No executions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Triggered by</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.map((ex) => (
              <TableRow
                key={ex.id}
                className="cursor-pointer"
                onClick={() => router.push(`/spaces/${spaceId}/executions/${ex.id}`)}
              >
                <TableCell>
                  <Badge variant={STATUS_VARIANT[ex.status] ?? 'secondary'}>{ex.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">{ex.triggeredBy}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ex.startedAt ? new Date(ex.startedAt).toLocaleString() : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {duration(ex.startedAt, ex.finishedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
