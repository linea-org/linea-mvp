'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Loading01Icon,
  Copy01Icon,
  Download01Icon,
  LayoutTable01Icon,
  RepeatIcon,
} from '@hugeicons/core-free-icons';
import { Spinner } from '@linea/ui/components/spinner';
import { useMutation } from '@tanstack/react-query';
import type { Node } from '@xyflow/react';
import type { NodeResult } from '../workflow-builder.types';
import { useApiClient } from '@/hooks/use-api-client';
import { StatusIcon, statusColor, statusLabel, type Log } from './bottom-panel-shared';

interface NodeRow {
  id: string;
  name: string;
  status: string;
  output?: unknown;
  error?: string;
  durationMs?: number | null;
  timestamp?: string;
}

export function LogsTab({
  nodes,
  nodeResults,
  runStatus,
  logs,
  logsLoading,
  workspaceId,
  podId,
  onRetryNode,
  executionOutput,
  streamingTokens,
}: {
  nodes: Node[];
  nodeResults: Record<string, NodeResult>;
  runStatus: { id: string; status: string } | null;
  logs: Log[];
  logsLoading: boolean;
  workspaceId: string;
  podId: string;
  onRetryNode?: (nodeId: string) => void;
  executionOutput?: unknown;
  streamingTokens?: Record<string, string>;
}) {
  const getApi = useApiClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);

  const logMap = useMemo<Map<string, Log>>(() => {
    const m = new Map<string, Log>();
    for (const l of logs) {
      const ex = m.get(l.nodeId);
      if (!ex || new Date(l.timestamp) >= new Date(ex.timestamp)) m.set(l.nodeId, l);
    }
    return m;
  }, [logs]);

  const rows = useMemo<NodeRow[]>(() => {
    return nodes
      .filter((n) => n.type !== 'start' && n.type !== 'end' && n.type !== 'note' && n.type !== 'frame')
      .map((n) => {
        const name = (n.data?.nodeName as string) ?? (n.data?.label as string) ?? n.type ?? n.id;
        const log = logMap.get(n.id);
        const live = nodeResults[n.id];
        if (log) {
          return {
            id: n.id,
            name,
            status: log.level === 'error' ? 'failed' : 'completed',
            output: log.data?.output,
            error: log.data?.error,
            durationMs: log.durationMs,
            timestamp: log.timestamp,
          };
        }
        if (live) {
          return {
            id: n.id,
            name,
            status: live.status,
            output: live.output,
            error: live.error,
            durationMs: live.durationMs,
          };
        }
        return { id: n.id, name, status: 'pending' };
      });
  }, [nodes, nodeResults, logMap]);

  const retryMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      if (!runStatus) throw new Error('No active run');
      const api = await getApi();
      await api.post(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${runStatus.id}/retry`,
        { nodeId },
      );
      return nodeId;
    },
    onSuccess: (nodeId) => onRetryNode?.(nodeId),
  });

  function copyNode(row: NodeRow) {
    const parts = [`Node: ${row.name}`, `Status: ${row.status}`];
    if (row.durationMs != null) parts.push(`Duration: ${row.durationMs}ms`);
    if (row.error) parts.push(`Error: ${row.error}`);
    else if (row.output !== undefined) parts.push(`Output: ${typeof row.output === 'string' ? row.output : JSON.stringify(row.output, null, 2)}`);
    void navigator.clipboard.writeText(parts.join('\n')).then(() => {
      setCopiedNodeId(row.id);
      setTimeout(() => setCopiedNodeId(null), 1500);
    });
  }

  function copyLogs() {
    const lines = rows
      .filter((r) => r.status !== 'pending')
      .map((r) => {
        const parts = [`Node: ${r.name}`, `Status: ${r.status}`];
        if (r.durationMs != null) parts.push(`Duration: ${r.durationMs}ms`);
        if (r.error) parts.push(`Error: ${r.error}`);
        else if (r.output !== undefined) parts.push(`Output: ${typeof r.output === 'string' ? r.output : JSON.stringify(r.output, null, 2)}`);
        return parts.join('\n');
      })
      .join('\n\n');
    void navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function exportLogs() {
    const payload = {
      executionId: runStatus?.id,
      status: runStatus?.status,
      exportedAt: new Date().toISOString(),
      nodes: rows.map((r) => ({
        nodeId: r.id,
        name: r.name,
        status: r.status,
        durationMs: r.durationMs ?? null,
        timestamp: r.timestamp ?? null,
        output: r.output ?? null,
        error: r.error ?? null,
      })),
      rawLogs: logs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${runStatus?.id?.slice(0, 8) ?? 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!runStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
        <HugeiconsIcon icon={Loading01Icon} className="size-6 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Run the workflow to see execution logs.</p>
      </div>
    );
  }

  if (logsLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 h-full text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Loading logs...
      </div>
    );
  }

  const hasActivity = rows.some((r) => r.status !== 'pending');
  const isDone = runStatus.status === 'completed' || runStatus.status === 'failed';

  if (!hasActivity) {
    if (isDone) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
          <HugeiconsIcon icon={LayoutTable01Icon} className="size-6 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">No node logs stored for this run.</p>
          <Link
            href={`/pods/${podId}/executions/${runStatus.id}`}
            className="text-xs text-blue-500 hover:underline"
          >
            View execution details
          </Link>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2 h-full text-xs text-muted-foreground">
        <Spinner className="size-3.5 text-blue-500" />
        Execution started...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border/30 bg-muted/20 shrink-0">
        <span className="text-[10px] text-muted-foreground">
          {rows.filter(r => r.status !== 'pending').length} / {rows.length} nodes
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={copyLogs}
            title="Copy logs as text"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <HugeiconsIcon icon={Copy01Icon} className={`size-3 ${copied ? 'text-green-500' : ''}`} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={exportLogs}
            title="Export logs as JSON"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <HugeiconsIcon icon={Download01Icon} className="size-3" />
            Export
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
      {runStatus?.status === 'completed' && executionOutput !== undefined && (
        <div className="mx-3 mt-3 mb-1 rounded-lg border border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1.5">
            Workflow Output
          </p>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground max-h-28 overflow-y-auto leading-relaxed">
            {typeof executionOutput === 'string'
              ? executionOutput
              : JSON.stringify(executionOutput, null, 2)}
          </pre>
        </div>
      )}
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
          <tr>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-6" />
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Node</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Duration</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExp = expandedId === row.id;
            const hasDetail = row.output !== undefined || !!row.error;
            const isPending = row.status === 'pending';
            return (
              <Fragment key={row.id}>
                <tr
                  className={`border-b border-border/40 transition-colors ${
                    isPending
                      ? 'opacity-40'
                      : hasDetail
                        ? 'cursor-pointer hover:bg-muted/30'
                        : 'hover:bg-muted/20'
                  }`}
                  onClick={() => !isPending && hasDetail && setExpandedId(isExp ? null : row.id)}
                >
                  <td className="px-3 py-2"><StatusIcon status={row.status} /></td>
                  <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                  <td className={`px-3 py-2 font-medium capitalize ${isPending ? 'text-muted-foreground' : statusColor(row.status)}`}>
                    {isPending ? 'pending' : statusLabel(row.status)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono">
                    {row.durationMs != null ? `${row.durationMs}ms` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5">
                      {!isPending && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyNode(row); }}
                          title="Copy node result"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <HugeiconsIcon
                            icon={Copy01Icon}
                            className={`size-3 ${copiedNodeId === row.id ? 'text-green-500' : ''}`}
                          />
                          {copiedNodeId === row.id ? 'Copied' : 'Copy'}
                        </button>
                      )}
                      {row.status === 'failed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); retryMutation.mutate(row.id); }}
                          disabled={retryMutation.isPending && retryMutation.variables === row.id}
                          title="Retry this node"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          {retryMutation.isPending && retryMutation.variables === row.id
                            ? <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />
                            : <HugeiconsIcon icon={RepeatIcon} className="size-3" />}
                          Retry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExp && hasDetail && (
                  <tr className="border-b border-border/40 bg-muted/10">
                    <td colSpan={6} className="px-3 py-2">
                      <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-36 overflow-y-auto text-foreground leading-relaxed">
                        {row.error
                          ? row.error
                          : typeof row.output === 'string'
                            ? row.output
                            : JSON.stringify(row.output, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
                {row.status === 'running' && streamingTokens?.[row.id] && (
                  <tr className="border-b border-border/40 bg-muted/5">
                    <td colSpan={6} className="px-3 py-1.5">
                      <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto text-muted-foreground leading-relaxed">
                        {streamingTokens[row.id]}
                      </pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
