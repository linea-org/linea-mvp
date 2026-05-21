'use client';

import { Fragment, useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Loading01Icon,
  Alert02Icon,
  Copy01Icon,
  Download01Icon,
  Search01Icon,
  CodeIcon,
  LayoutTable01Icon,
  RepeatIcon,
} from '@hugeicons/core-free-icons';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import type { Node } from '@xyflow/react';
import type { NodeResult } from '../index';
import type { ValidationState } from '../toolbar';
import { createApiClient } from '@/lib/api';

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
  nodes: Node[];
  nodeResults: Record<string, NodeResult>;
  validationState: ValidationState;
  runStatus: { id: string; status: string } | null;
  workspaceId: string;
  podId: string;
  workflowId?: string;
  token: string;
  onRetryNode?: (nodeId: string) => void;
  executionOutput?: unknown;
  streamingTokens?: Record<string, string>;
}

type BottomTab = 'logs' | 'timeline' | 'issues' | 'variables';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

function formatRunTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

/* ---- Status helpers ------------------------------------------ */
function StatusIcon({ status }: { status: string }) {
  if (status === 'running')   return <HugeiconsIcon icon={Loading01Icon}          className="size-3 text-blue-500 animate-spin shrink-0" />;
  if (status === 'completed') return <HugeiconsIcon icon={CheckmarkCircle01Icon}  className="size-3 text-green-500 shrink-0" />;
  if (status === 'failed')    return <HugeiconsIcon icon={Cancel01Icon}            className="size-3 text-red-500 shrink-0" />;
  return <span className="size-3 rounded-full border border-border bg-muted/60 shrink-0 inline-block" />;
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusColor(status: string) {
  if (status === 'running')   return 'text-blue-500';
  if (status === 'completed') return 'text-green-600';
  if (status === 'failed')    return 'text-red-500';
  return 'text-muted-foreground';
}

/* ---- Logs tab ------------------------------------------------ */
interface NodeRow {
  id: string;
  name: string;
  status: string;
  output?: unknown;
  error?: string;
  durationMs?: number | null;
  timestamp?: string;
}

function LogsTab({
  nodes,
  nodeResults,
  runStatus,
  logs,
  logsLoading,
  workspaceId,
  podId,
  token,
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
  token: string;
  onRetryNode?: (nodeId: string) => void;
  executionOutput?: unknown;
  streamingTokens?: Record<string, string>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);

  // Deduplicate logs by nodeId — keep the latest entry per node
  const logMap = useMemo<Map<string, Log>>(() => {
    const m = new Map<string, Log>();
    for (const l of logs) {
      const ex = m.get(l.nodeId);
      if (!ex || new Date(l.timestamp) >= new Date(ex.timestamp)) m.set(l.nodeId, l);
    }
    return m;
  }, [logs]);

  // One display row per workflow node (structural nodes excluded)
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

  async function retryNode(nodeId: string) {
    if (!runStatus) return;
    setRetrying(nodeId);
    try {
      const api = createApiClient(token);
      await api.post(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${runStatus.id}/retry`,
        { nodeId },
      );
      onRetryNode?.(nodeId);
    } catch {
      // failure is surfaced via SSE update
    } finally {
      setRetrying(null);
    }
  }

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
        <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin" />
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
        <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin text-blue-500" />
        Execution started...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
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
                          onClick={(e) => { e.stopPropagation(); void retryNode(row.id); }}
                          disabled={retrying === row.id}
                          title="Retry this node"
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          {retrying === row.id
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

/* ---- Timeline tab -------------------------------------------- */
interface TimelineEntry {
  id: string;
  name: string;
  status: string;
  startedAt: number;
  durationMs: number;
}

function TimelineTab({
  nodes,
  nodeResults,
  logs,
  runStatus,
}: {
  nodes: Node[];
  nodeResults: Record<string, NodeResult>;
  logs: Log[];
  runStatus: { id: string; status: string } | null;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);
  void tick;

  function getNodeName(id: string) {
    const n = nodes.find((x) => x.id === id);
    return (n?.data?.nodeName as string) ?? (n?.data?.label as string) ?? n?.type ?? id;
  }

  if (!runStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-2">
        <HugeiconsIcon icon={LayoutTable01Icon} className="size-6 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Run the workflow to see the execution timeline.</p>
      </div>
    );
  }

  const isDone = runStatus.status === 'completed' || runStatus.status === 'failed';

  let entries: TimelineEntry[] = [];

  if (isDone && logs.length > 0) {
    entries = logs
      .filter((l) => l.durationMs != null && l.durationMs > 0)
      .map((l) => {
        const completedAt = new Date(l.timestamp).getTime();
        const dur = l.durationMs ?? 0;
        return {
          id: l.nodeId,
          name: getNodeName(l.nodeId),
          status: l.level === 'error' ? 'failed' : 'completed',
          startedAt: completedAt - dur,
          durationMs: dur,
        };
      });
  } else {
    entries = Object.entries(nodeResults)
      .filter(([, r]) => r.startedAt != null)
      .map(([nodeId, r]) => ({
        id: nodeId,
        name: getNodeName(nodeId),
        status: r.status,
        startedAt: r.startedAt!,
        durationMs: r.durationMs ?? (r.status === 'running' ? Date.now() - r.startedAt! : 0),
      }));
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 h-full text-xs text-muted-foreground">
        <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin text-blue-500" />
        Waiting for nodes to start...
      </div>
    );
  }

  entries.sort((a, b) => a.startedAt - b.startedAt);

  const minStart = Math.min(...entries.map((e) => e.startedAt));
  const maxEnd = Math.max(...entries.map((e) => e.startedAt + e.durationMs));
  const totalSpan = Math.max(maxEnd - minStart, 1);

  const totalMs = maxEnd - minStart;
  const totalLabel = totalMs >= 1000 ? `${(totalMs / 1000).toFixed(2)}s` : `${totalMs}ms`;

  return (
    <div className="h-full overflow-auto">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Execution Timeline
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">{totalLabel} total</span>
        </div>

        {/* Gantt rows */}
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const leftPct = ((entry.startedAt - minStart) / totalSpan) * 100;
            const widthPct = Math.max(0.5, (entry.durationMs / totalSpan) * 100);
            const barColor =
              entry.status === 'completed' ? '#10b981'
              : entry.status === 'failed'   ? '#ef4444'
              : '#3b82f6';
            const durLabel = entry.durationMs >= 1000
              ? `${(entry.durationMs / 1000).toFixed(2)}s`
              : `${entry.durationMs}ms`;

            return (
              <div key={entry.id} className="flex items-center gap-2.5 group">
                <div className="w-28 shrink-0">
                  <p className="text-[11px] font-medium text-foreground truncate" title={entry.name}>
                    {entry.name}
                  </p>
                </div>
                <div className="relative flex-1 h-5 rounded bg-muted/50">
                  <div
                    className="absolute top-0 h-full rounded transition-all"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: barColor,
                      opacity: entry.status === 'running' ? 0.7 : 0.85,
                    }}
                  />
                  {entry.status === 'running' && (
                    <div
                      className="absolute top-0 h-full rounded animate-pulse"
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: barColor,
                        opacity: 0.3,
                      }}
                    />
                  )}
                </div>
                <div className="w-14 shrink-0 text-right">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {entry.status === 'running' ? '...' : durLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Time axis ticks */}
        <div className="mt-2 flex ml-[120px] mr-[64px]">
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const ms = pct * totalMs;
            const label = ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
            return (
              <div
                key={pct}
                className="flex-1 text-[9px] text-muted-foreground/50 font-mono"
                style={{ textAlign: pct === 0 ? 'left' : pct === 1 ? 'right' : 'center' }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---- Issues tab ---------------------------------------------- */
function IssuesTab({ validationState }: { validationState: ValidationState }) {
  if (validationState.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-6 text-green-500/60" />
        <p className="text-xs text-muted-foreground">No issues detected. Workflow looks good.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1.5">
        {validationState.issues.map((issue, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${
              validationState.level === 'error'
                ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20'
                : 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'
            }`}
          >
            <HugeiconsIcon
              icon={Alert02Icon}
              className={`size-3.5 shrink-0 mt-0.5 ${validationState.level === 'error' ? 'text-red-500' : 'text-amber-500'}`}
            />
            <span className={validationState.level === 'error' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}>
              {issue}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ---- Variables tab ------------------------------------------- */
function VariablesTab({ nodes, nodeResults }: { nodes: Node[]; nodeResults: Record<string, NodeResult> }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const refs: Array<{ path: string; value?: unknown; source: string }> = [];

  const startNode = nodes.find((n) => n.type === 'start');
  if (startNode) {
    refs.push({ path: '{{trigger.input}}', source: 'Start' });
    const testInput = startNode.data.testInput as Record<string, unknown> | undefined;
    if (testInput) {
      for (const [k] of Object.entries(testInput)) {
        refs.push({ path: `{{trigger.input.${k}}}`, source: 'Start' });
      }
    }
  }

  for (const node of nodes) {
    if (node.type === 'start' || node.type === 'end' || node.type === 'note') continue;
    const name = (node.data.nodeName as string) ?? node.type ?? node.id;
    const result = nodeResults[node.id];
    refs.push({
      path: `{{${name}.output}}`,
      value: result?.output,
      source: name,
    });
    if (result?.error) {
      refs.push({ path: `{{${name}.error}}`, value: result.error, source: name });
    }
  }

  if (refs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <HugeiconsIcon icon={CodeIcon} className="size-6 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Add nodes to see available variable references.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        {refs.map(({ path, value, source }) => (
          <div key={path} className="group flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-muted/40 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <code className="text-[11px] font-mono text-violet-600 dark:text-violet-400 break-all">{path}</code>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">from {source}</span>
              </div>
              {value !== undefined && (
                <p className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </p>
              )}
            </div>
            <button
              onClick={() => copy(path)}
              title="Copy path"
              className="shrink-0 opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-foreground transition-all"
            >
              <HugeiconsIcon
                icon={Copy01Icon}
                className={`size-3 ${copied === path ? 'text-green-500' : ''}`}
              />
            </button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

/* ---- History entry type --------------------------------------- */
interface HistoryEntry {
  id: string;
  status: string;
  createdAt: string;
}

/* ---- Main component ------------------------------------------ */
export function BottomPanel({ nodes, nodeResults, validationState, runStatus, workspaceId, podId, workflowId, token, onRetryNode, executionOutput, streamingTokens }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTab>('logs');
  const [panelHeight, setPanelHeight] = useState(200);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // History list: newest first. historyIdx=0 is the most recent run.
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [runDropdownOpen, setRunDropdownOpen] = useState(false);
  const [runSearch, setRunSearch] = useState('');
  const [autoOpenLogs, setAutoOpenLogs] = useState(() => {
    try { return localStorage.getItem('linea:logs:auto-open') !== 'false'; } catch { return true; }
  });
  const prevRunId = useRef<string | null>(null);
  const prevStartedId = useRef<string | null>(null);
  const didLoadHistory = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem('linea:logs:auto-open', String(autoOpenLogs)); } catch { /* ignore */ }
  }, [autoOpenLogs]);

  useEffect(() => {
    if (!runDropdownOpen) return;
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setRunDropdownOpen(false);
        setRunSearch('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [runDropdownOpen]);

  async function fetchLogs(execId: string) {
    setLogsLoading(true);
    try {
      const api = createApiClient(token);
      const data = await api.get<Log[]>(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${execId}/logs`,
      );
      setLogs(data);
    } catch {
      // logs are supplementary; silently fail
    } finally {
      setLogsLoading(false);
    }
  }

  async function fetchHistory() {
    if (!workflowId) return;
    try {
      const api = createApiClient(token);
      const data = await api.get<{ executions: HistoryEntry[] }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions?workflowId=${workflowId}&limit=20`,
      );
      const list: HistoryEntry[] = (data as any)?.executions ?? (Array.isArray(data) ? data : []);
      setHistoryList(list);
    } catch {
      // silently fail
    }
  }

  // Open when run starts — reset to clean slate, add run to history list immediately
  useEffect(() => {
    if (runStatus?.id && runStatus.id !== prevStartedId.current) {
      prevStartedId.current = runStatus.id;
      setLogs([]);
      setHistoryIdx(0);
      // Prepend the new run so it appears in the list right away (before fetchHistory completes)
      setHistoryList((prev) => {
        if (prev.some((e) => e.id === runStatus.id)) return prev;
        return [{ id: runStatus.id, status: runStatus.status, createdAt: new Date().toISOString() }, ...prev];
      });
      if (autoOpenLogs) { setActiveTab('logs'); setOpen(true); }
    }
  }, [runStatus?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch logs + refresh history when run completes
  useEffect(() => {
    const isDone = runStatus?.status === 'completed' || runStatus?.status === 'failed';
    if (isDone && runStatus?.id !== prevRunId.current) {
      prevRunId.current = runStatus!.id;
      setActiveTab('logs');
      setOpen(true);
      setLogs([]);
      void fetchLogs(runStatus!.id);
      // Optimistically update the status of this run in the history list
      // so the dropdown doesn't show "running" while fetchHistory() is in flight
      setHistoryList((prev) =>
        prev.map((e) => e.id === runStatus!.id ? { ...e, status: runStatus!.status } : e),
      );
      void fetchHistory();
    }
  }, [runStatus?.status, runStatus?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll logs every 2s while running
  useEffect(() => {
    const isRunning = runStatus?.status === 'running' || runStatus?.status === 'queued';
    if (!isRunning || !runStatus?.id) return;
    const id = runStatus.id;
    const interval = setInterval(() => void fetchLogs(id), 2000);
    return () => clearInterval(interval);
  }, [runStatus?.id, runStatus?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: load history list (no active run)
  useEffect(() => {
    if (runStatus || didLoadHistory.current || !workflowId) return;
    didLoadHistory.current = true;
    void fetchHistory();
  }, [workflowId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When history list loads or user navigates, fetch logs for the viewed run (only when not actively running)
  useEffect(() => {
    if (runStatus) return;
    const entry = historyList[historyIdx];
    if (!entry) return;
    prevRunId.current = entry.id;
    prevStartedId.current = entry.id;
    setLogs([]);
    void fetchLogs(entry.id);
  }, [historyIdx, historyList]); // eslint-disable-line react-hooks/exhaustive-deps

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelHeight;

    function onMove(ev: MouseEvent) {
      const delta = startY - ev.clientY;
      setPanelHeight(Math.max(80, Math.min(520, startH + delta)));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Use active run status, or fall back to the currently-viewed history entry
  const historyEntry = historyList[historyIdx];
  const effectiveRunStatus = runStatus ?? (historyEntry ? { id: historyEntry.id, status: historyEntry.status } : null);

  const liveCount = Object.keys(nodeResults).length;
  const TABS: Array<{ id: BottomTab; label: string; badge?: number | string }> = [
    {
      id: 'logs',
      label: 'Logs',
      badge: effectiveRunStatus
        ? logs.length > 0 ? logs.length : liveCount || undefined
        : undefined,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      badge: undefined,
    },
    {
      id: 'issues',
      label: 'Issues',
      badge: validationState.issues.length > 0 ? validationState.issues.length : undefined,
    },
    { id: 'variables', label: 'Variables', badge: undefined },
  ];

  const isRunning = runStatus?.status === 'running' || runStatus?.status === 'queued';

  return (
    <div className="shrink-0 border-t border-border bg-background select-none">
      <div className="flex h-8 items-center gap-0.5 px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (!open) setOpen(true);
            }}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
              activeTab === tab.id && open
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`rounded-full px-1 py-0 text-[10px] leading-4 font-semibold ${
                tab.id === 'issues' && validationState.level === 'error'
                  ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                  : tab.id === 'issues' && validationState.level === 'warning'
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setAutoOpenLogs((v) => !v)}
          title={autoOpenLogs ? 'Logs auto-open on run: on' : 'Logs auto-open on run: off'}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mr-1"
        >
          <span className={`size-1.5 rounded-full shrink-0 ${autoOpenLogs ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
          auto-open
        </button>

        {/* Active run indicator */}
        {isRunning && (
          <div className="flex items-center gap-1.5 mr-2">
            <HugeiconsIcon icon={Loading01Icon} className="size-3 text-blue-500 animate-spin" />
            <span className="text-[11px] font-medium text-blue-500">Running</span>
          </div>
        )}

        {/* Run history selector — searchable dropdown */}
        {!isRunning && historyList.length > 0 && (
          <div ref={dropdownRef} className="relative mr-2">
            <button
              onClick={() => { setRunDropdownOpen((v) => !v); setRunSearch(''); }}
              className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] hover:bg-muted/50 transition-colors"
            >
              <StatusIcon status={effectiveRunStatus?.status ?? 'pending'} />
              <span className={`font-medium capitalize ${statusColor(effectiveRunStatus?.status ?? 'pending')}`}>
                {statusLabel(effectiveRunStatus?.status ?? '')}
              </span>
              <span className="text-muted-foreground">
                · {formatRunTime(historyList[historyIdx]?.createdAt)}
              </span>
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-3 text-muted-foreground" />
            </button>

            {runDropdownOpen && (
              <div className="absolute bottom-full right-0 mb-1 w-64 rounded-lg border bg-popover shadow-lg z-50">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b">
                  <HugeiconsIcon icon={Search01Icon} className="size-3 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search by status or time..."
                    value={runSearch}
                    onChange={(e) => setRunSearch(e.target.value)}
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto p-1">
                  {historyList
                    .map((entry, idx) => ({ entry, idx }))
                    .filter(({ entry }) => {
                      if (!runSearch) return true;
                      const q = runSearch.toLowerCase();
                      return entry.status.includes(q) || formatRunTime(entry.createdAt).toLowerCase().includes(q);
                    })
                    .map(({ entry, idx }) => (
                      <button
                        key={entry.id}
                        onClick={() => { setHistoryIdx(idx); setRunDropdownOpen(false); setRunSearch(''); }}
                        className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors ${
                          idx === historyIdx ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                      >
                        <StatusIcon status={entry.status} />
                        <span className="flex-1 truncate text-muted-foreground">
                          {formatRunTime(entry.createdAt)}
                        </span>
                        <span className={`capitalize font-medium shrink-0 ${statusColor(entry.status)}`}>
                          {statusLabel(entry.status)}
                        </span>
                        {idx === 0 && (
                          <span className="text-[9px] text-muted-foreground/60 shrink-0">latest</span>
                        )}
                      </button>
                    ))}
                  {historyList.length > 0 && runSearch && historyList.filter(e => {
                    const q = runSearch.toLowerCase();
                    return e.status.includes(q) || formatRunTime(e.createdAt).toLowerCase().includes(q);
                  }).length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-3">No runs match</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse panel' : 'Expand panel'}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <HugeiconsIcon icon={open ? ArrowDown01Icon : ArrowUp01Icon} className="size-3.5" />
        </button>
      </div>

      {open && (
        <>
          <div
            className="h-1 cursor-row-resize bg-transparent hover:bg-border/60 transition-colors"
            onMouseDown={onResizeStart}
          />
          <div style={{ height: panelHeight }} className="overflow-hidden border-t border-border/40">
            {activeTab === 'logs' && (
              <LogsTab
                nodes={nodes}
                nodeResults={nodeResults}
                runStatus={effectiveRunStatus}
                logs={logs}
                logsLoading={logsLoading}
                workspaceId={workspaceId}
                podId={podId}
                token={token}
                onRetryNode={onRetryNode}
                executionOutput={executionOutput}
                streamingTokens={streamingTokens}
              />
            )}
            {activeTab === 'timeline' && (
              <TimelineTab
                nodes={nodes}
                nodeResults={nodeResults}
                logs={logs}
                runStatus={effectiveRunStatus}
              />
            )}
            {activeTab === 'issues' && (
              <IssuesTab validationState={validationState} />
            )}
            {activeTab === 'variables' && (
              <VariablesTab nodes={nodes} nodeResults={nodeResults} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
