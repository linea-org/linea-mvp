'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, CheckmarkCircle01Icon, Cancel01Icon, ClockIcon } from '@hugeicons/core-free-icons';
import { useApiClient } from '@/hooks/use-api-client';
import { Spinner } from '@linea/ui/components/spinner';

interface Log {
  id: string;
  nodeId: string;
  level: 'info' | 'error';
  message: string;
  data?: { output?: unknown; error?: string } | null;
  durationMs?: number | null;
  timestamp: string;
}

interface Props {
  executionId: string;
  workspaceId: string;
  podId: string;
  status: string;
  nodes: { id: string; data: Record<string, unknown> }[];
}

export function ExecutionLogsDrawer({ executionId, workspaceId, podId, status, nodes }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const getApi = useApiClient();

  const isDone = status === 'completed' || status === 'failed';

  const { data: logs = [], isLoading: loading } = useQuery<Log[]>({
    queryKey: ['execution-logs', workspaceId, podId, executionId],
    enabled: open && isDone,
    queryFn: async () => {
      const api = await getApi();
      return api.get<Log[]>(`/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/logs`);
    },
  });

  // Auto-open when execution completes/fails
  useEffect(() => {
    if (isDone) setOpen(true);
  }, [isDone]);

  function getNodeName(nodeId: string): string {
    const node = nodes.find((n) => n.id === nodeId);
    return (node?.data?.nodeName as string) ?? (node?.data?.label as string) ?? nodeId;
  }

  const statusColor = status === 'completed' ? 'text-green-600' : status === 'failed' ? 'text-red-500' : 'text-blue-500';

  return (
    <div className="shrink-0 border-t border-border bg-background">
      {/* Toggle strip */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">Execution Logs</span>
          {logs.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {logs.length}
            </span>
          )}
          <span className={`font-medium capitalize ${statusColor}`}>{status}</span>
        </div>
        <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowUp01Icon} className="size-3.5 text-muted-foreground" />
      </button>

      {/* Log list */}
      {open && (
        <div className="max-h-52 overflow-y-auto border-t border-border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Loading logs…
            </div>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No logs for this execution.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wide text-muted-foreground w-5"></th>
                  <th className="px-3 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Node</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Duration</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wide text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedLog === log.id;
                  const hasOutput = log.data?.output !== undefined || log.data?.error;
                  return (
                    <>
                      <tr
                        key={log.id}
                        className={`border-b border-border/50 hover:bg-muted/20 ${hasOutput ? 'cursor-pointer' : ''}`}
                        onClick={() => hasOutput && setExpandedLog(isExpanded ? null : log.id)}
                      >
                        <td className="px-3 py-1.5">
                          {log.level === 'error'
                            ? <HugeiconsIcon icon={Cancel01Icon} className="size-3 text-red-500" />
                            : <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3 text-green-500" />
                          }
                        </td>
                        <td className="px-3 py-1.5 font-medium text-foreground">{getNodeName(log.nodeId)}</td>
                        <td className={`px-3 py-1.5 font-medium capitalize ${log.level === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                          {log.level === 'error' ? 'failed' : 'completed'}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                      {isExpanded && hasOutput && (
                        <tr key={`${log.id}-expanded`} className="border-b border-border/50 bg-muted/10">
                          <td colSpan={5} className="px-3 py-2">
                            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto text-foreground">
                              {log.data?.error
                                ? log.data.error
                                : typeof log.data?.output === 'string'
                                  ? log.data.output
                                  : JSON.stringify(log.data?.output, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
