'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Separator } from '@linea/ui/components/separator';
import { ScrollArea } from '@linea/ui/components/scroll-area';

interface Execution {
  id: string;
  status: string;
  triggeredBy: string;
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface ExecutionLog {
  id: string;
  nodeId: string | null;
  level: string;
  message: string;
  data: unknown;
  timestamp: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  running: 'secondary',
  queued: 'outline',
  failed: 'destructive',
  cancelled: 'secondary',
  suspended: 'outline',
};

const LIVE_STATUSES = new Set(['queued', 'running', 'suspended']);

export default function ExecutionDetailPage() {
  const { spaceId, id } = useParams<{ spaceId: string; id: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    if (!activeWorkspace) return null;
    try {
      const token = await getToken();
      if (!token) return null;
      const api = createApiClient(token);
      const base = `/workspaces/${activeWorkspace.id}/spaces/${spaceId}/executions/${id}`;
      const [ex, logRows] = await Promise.all([
        api.get<Execution>(base),
        api.get<ExecutionLog[]>(`${base}/logs`),
      ]);
      setExecution(ex);
      setLogs(logRows);
      return ex;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (wsLoading || !activeWorkspace) return;

    void loadData().then((ex) => {
      setLoading(false);
      if (ex && LIVE_STATUSES.has(ex.status)) {
        pollRef.current = setInterval(async () => {
          const updated = await loadData();
          if (updated && !LIVE_STATUSES.has(updated.status)) {
            clearInterval(pollRef.current!);
          }
        }, 3000);
      }
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace, wsLoading, spaceId, id]);

  if (loading || wsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!execution) {
    return <p className="text-sm text-muted-foreground">Execution not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold font-mono text-sm">{execution.id}</h1>
        <Badge variant={STATUS_VARIANT[execution.status] ?? 'secondary'}>{execution.status}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Triggered by</p>
          <p className="font-medium">{execution.triggeredBy}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Started</p>
          <p className="font-medium">
            {execution.startedAt ? new Date(execution.startedAt).toLocaleString() : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Finished</p>
          <p className="font-medium">
            {execution.finishedAt ? new Date(execution.finishedAt).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="mb-2 text-sm font-medium">Input</p>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-48">
            {JSON.stringify(execution.input, null, 2)}
          </pre>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Output</p>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-48">
            {execution.output ? JSON.stringify(execution.output, null, 2) : execution.error ?? '—'}
          </pre>
        </div>
      </div>

      <Separator />

      <div>
        <p className="mb-3 text-sm font-medium">Logs</p>
        <ScrollArea className="h-72 rounded-md border">
          <div className="p-3 space-y-1 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">No logs yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-destructive'
                        : log.level === 'warn'
                          ? 'text-yellow-600'
                          : ''
                    }
                  >
                    {log.nodeId ? `[${log.nodeId}] ` : ''}{log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
