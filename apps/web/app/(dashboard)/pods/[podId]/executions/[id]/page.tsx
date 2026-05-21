'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useWorkspace } from '@/contexts/workspace-context';
import { createApiClient } from '@/lib/api';
import { Badge } from '@linea/ui/components/badge';
import { Button } from '@linea/ui/components/button';
import { Skeleton } from '@linea/ui/components/skeleton';
import { Separator } from '@linea/ui/components/separator';
import { Textarea } from '@linea/ui/components/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@linea/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@linea/ui/components/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@linea/ui/components/collapsible';
import { createPortal } from 'react-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/workflow-builder/nodes/node-types';

interface PendingInterrupt {
  type?: 'ask_human' | 'approval' | 'tool_approval';
  message?: string;
  question?: string;
  prompt?: string;
}

interface Execution {
  id: string;
  workflowId: string | null;
  status: string;
  triggeredBy: string;
  input: Record<string, unknown>;
  output: unknown;
  error: string | null;
  nodeResults: Record<string, NodeResult>;
  variables?: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface NodeResult {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: unknown;
  error?: string;
  completedAt?: string;
  durationMs?: number;
  toolCallLog?: { tool: string; input: unknown; output: unknown }[];
  tokenUsage?: { input: number; output: number };
}

interface ExecutionLog {
  id: string;
  nodeId: string | null;
  level: string;
  message: string;
  data: unknown;
  durationMs: number | null;
  timestamp: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    nodeType?: string;
    nodeName?: string;
    name?: string;
    label?: string;
    logLevel?: string;
    logRetentionDays?: number | null;
    [key: string]: unknown;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
}

interface WorkflowInfo {
  id: string;
  name: string;
  logLevel: 'none' | 'errors' | 'info' | 'debug';
  logRetentionDays: number | null;
  definition: { nodes: WorkflowNode[]; edges?: WorkflowEdge[] };
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

function formatDuration(ms: number | undefined | null) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function NodeStatusIcon({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold">
        ✓
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive text-white text-[10px] font-bold">
        ✕
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    );
  }
  if (status === 'suspended') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-white text-[10px] font-bold">
        ⏸
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/40 text-white text-[10px]">
        —
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40" />
  );
}

function GanttTimeline({
  execution,
  logs,
  nodeMap,
}: {
  execution: Execution;
  logs: ExecutionLog[];
  nodeMap: Map<string, WorkflowNode>;
}) {
  const nodeResults = execution.nodeResults ?? {};
  const execStart = execution.startedAt ? new Date(execution.startedAt).getTime() : null;
  const execEnd = execution.finishedAt
    ? new Date(execution.finishedAt).getTime()
    : Date.now();

  // Build timing map: start with log-derived data (always present), then let
  // nodeResults overwrite with more-precise values where available.
  const timingMap = new Map<string, { nodeId: string; name: string; status: string; startMs: number | null; endMs: number | null; durMs: number | null }>();

  for (const log of logs) {
    if (!log.nodeId || log.durationMs == null) continue;
    const endMs = new Date(log.timestamp).getTime();
    const durMs = log.durationMs;
    const startMs = durMs > 0 ? endMs - durMs : endMs;
    const nodeDef = nodeMap.get(log.nodeId);
    const name = nodeDef?.data?.nodeName ?? nodeDef?.data?.name ?? nodeDef?.data?.label ?? nodeDef?.type ?? log.nodeId;
    timingMap.set(log.nodeId, {
      nodeId: log.nodeId,
      name,
      status: log.level === 'error' ? 'failed' : 'completed',
      startMs,
      endMs,
      durMs,
    });
  }

  for (const [nodeId, result] of Object.entries(nodeResults)) {
    const nodeDef = nodeMap.get(nodeId);
    const name = nodeDef?.data?.nodeName ?? nodeDef?.data?.name ?? nodeDef?.data?.label ?? nodeDef?.type ?? nodeId;
    const endMs = result.completedAt ? new Date(result.completedAt).getTime() : (timingMap.get(nodeId)?.endMs ?? null);
    const durMs = result.durationMs ?? (timingMap.get(nodeId)?.durMs ?? null);
    const startMs = endMs != null && durMs != null ? endMs - durMs : (timingMap.get(nodeId)?.startMs ?? null);
    if (endMs != null || startMs != null) {
      timingMap.set(nodeId, { nodeId, name, status: result.status, startMs, endMs, durMs });
    }
  }

  const rows = Array.from(timingMap.values()).filter((r) => r.endMs != null || r.startMs != null);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No timing data available. Make sure log level is set to Info or Debug.</p>;
  }

  const effectiveStart = execStart ?? Math.min(...rows.map((r) => r.startMs ?? r.endMs ?? Date.now()));

  const totalMs = Math.max(execEnd - effectiveStart, 1);

  const STATUS_BAR: Record<string, string> = {
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    running: 'bg-blue-500 animate-pulse',
    suspended: 'bg-amber-400',
    skipped: 'bg-muted-foreground/30',
  };

  const TIME_MARKS = 4;
  const marks = Array.from({ length: TIME_MARKS + 1 }, (_, i) => {
    const ms = (totalMs / TIME_MARKS) * i;
    return { pct: (ms / totalMs) * 100, label: formatDuration(ms) ?? '' };
  });

  return (
    <div className="space-y-1">
      {/* Time axis */}
      <div className="relative h-5 ml-36">
        {marks.map((m) => (
          <span
            key={m.pct}
            className="absolute text-[10px] text-muted-foreground -translate-x-1/2 top-0"
            style={{ left: `${m.pct}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {rows.map(({ nodeId, name, status, startMs, endMs, durMs }) => {
          const barLeft = startMs != null ? ((startMs - effectiveStart) / totalMs) * 100 : 0;
          const barWidth = durMs ? (durMs / totalMs) * 100 : 1;
          const barColor = STATUS_BAR[status] ?? 'bg-muted-foreground/30';

          return (
            <div key={nodeId} className="flex items-center gap-2">
              <span className="w-36 shrink-0 truncate text-xs text-muted-foreground text-right pr-2" title={name}>
                {name}
              </span>
              <div className="relative flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                <div
                  className={`absolute top-0 h-full rounded ${barColor} min-w-[3px]`}
                  style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 0.5)}%` }}
                  title={durMs ? `${formatDuration(durMs)}` : status}
                />
              </div>
              <span className="w-14 shrink-0 text-[10px] text-muted-foreground text-right font-mono">
                {durMs ? formatDuration(durMs) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 text-[10px] text-muted-foreground">
        {Object.entries({ completed: 'bg-green-500', failed: 'bg-red-500', running: 'bg-blue-500', suspended: 'bg-amber-400', skipped: 'bg-muted-foreground/30' }).map(([s, c]) => (
          <span key={s} className="flex items-center gap-1 capitalize">
            <span className={`size-2 rounded-full ${c}`} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function NodeTimeline({
  execution,
  logs,
  nodeMap,
  onReplayFrom,
}: {
  execution: Execution;
  logs: ExecutionLog[];
  nodeMap: Map<string, WorkflowNode>;
  onReplayFrom?: (nodeId: string) => void;
}) {
  const nodeResults = execution.nodeResults ?? {};

  // Derive timeline order: nodeIds in first-seen order from logs, then supplement from nodeResults
  const seenOrder: string[] = [];
  const seen = new Set<string>();

  for (const log of logs) {
    if (log.nodeId && !seen.has(log.nodeId)) {
      seenOrder.push(log.nodeId);
      seen.add(log.nodeId);
    }
  }
  for (const nodeId of Object.keys(nodeResults)) {
    if (!seen.has(nodeId)) {
      seenOrder.push(nodeId);
      seen.add(nodeId);
    }
  }

  if (seenOrder.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {execution.status === 'queued'
          ? 'Waiting to start…'
          : 'No node activity yet.'}
      </p>
    );
  }

  const logsByNode = new Map<string, ExecutionLog[]>();
  for (const log of logs) {
    if (!log.nodeId) continue;
    const arr = logsByNode.get(log.nodeId) ?? [];
    arr.push(log);
    logsByNode.set(log.nodeId, arr);
  }

  return (
    <div className="space-y-2">
      {seenOrder.map((nodeId, i) => {
        const result = nodeResults[nodeId];
        const nodeDef = nodeMap.get(nodeId);
        const nodeName =
          nodeDef?.data?.nodeName ??
          nodeDef?.data?.name ??
          nodeDef?.data?.label ??
          nodeDef?.type ??
          nodeId;
        const nodeType = nodeDef?.data?.nodeType ?? nodeDef?.type ?? '';
        const status = result?.status ?? 'pending';
        const duration = result?.durationMs ?? logs.find((l) => l.nodeId === nodeId && l.durationMs != null)?.durationMs;
        const nodeLogs = logsByNode.get(nodeId) ?? [];
        const hasDetails =
          result?.output != null ||
          result?.error ||
          (result?.toolCallLog?.length ?? 0) > 0 ||
          (result?.tokenUsage != null) ||
          nodeLogs.length > 0;

        return (
          <Collapsible key={nodeId} disabled={!hasDetails}>
            <div className="rounded-lg border bg-card">
              <CollapsibleTrigger asChild>
                <button
                  className="group/node flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                  disabled={!hasDetails}
                >
                  <div className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
                    <span className="w-4 text-right">{i + 1}</span>
                  </div>
                  <NodeStatusIcon status={status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{nodeName}</p>
                    {nodeType && nodeType !== nodeName && (
                      <p className="text-xs text-muted-foreground capitalize">{nodeType}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {result?.tokenUsage && (
                      <span className="text-xs text-muted-foreground">
                        {result.tokenUsage.input + result.tokenUsage.output} tokens
                      </span>
                    )}
                    {duration != null && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {formatDuration(duration)}
                      </span>
                    )}
                    {status === 'failed' && result?.error && (
                      <span className="text-xs text-destructive truncate max-w-[160px]">
                        {result.error}
                      </span>
                    )}
                    {onReplayFrom && status === 'completed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onReplayFrom(nodeId); }}
                        className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover/node:opacity-100"
                        title="Re-run workflow from this node"
                      >
                        ↩ from here
                      </button>
                    )}
                    {hasDetails && (
                      <span className="text-muted-foreground text-xs">▾</span>
                    )}
                  </div>
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t px-4 py-3 space-y-3">
                  {nodeLogs.length > 0 && (
                    <div className="space-y-1">
                      {nodeLogs.map((log) => (
                        <div key={log.id} className="flex gap-2 font-mono text-xs">
                          <span className="text-muted-foreground shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={
                              log.level === 'error'
                                ? 'text-destructive'
                                : log.level === 'warn'
                                  ? 'text-yellow-600'
                                  : 'text-muted-foreground'
                            }
                          >
                            [{log.level}]
                          </span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {result?.tokenUsage && (
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Tokens in: <strong>{result.tokenUsage.input}</strong></span>
                      <span>Tokens out: <strong>{result.tokenUsage.output}</strong></span>
                    </div>
                  )}

                  {(result?.toolCallLog?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Tool calls</p>
                      <div className="space-y-1">
                        {result!.toolCallLog!.map((tc, j) => (
                          <div key={j} className="rounded border bg-muted/40 px-2 py-1.5 text-xs font-mono">
                            <span className="font-medium">{tc.tool}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result?.output != null && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Output</p>
                      <pre className="rounded bg-muted p-2 text-xs overflow-auto max-h-40">
                        {typeof result.output === 'string'
                          ? result.output
                          : JSON.stringify(result.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {result?.error && (
                    <div>
                      <p className="text-xs font-medium text-destructive mb-1">Error</p>
                      <pre className="rounded bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive overflow-auto max-h-40">
                        {result.error}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

const STATUS_OUTLINE: Record<string, React.CSSProperties> = {
  completed: { outline: '2px solid #22c55e', outlineOffset: '3px', borderRadius: '10px' },
  failed: { outline: '2px solid #ef4444', outlineOffset: '3px', borderRadius: '10px' },
  running: { outline: '2px solid #3b82f6', outlineOffset: '3px', borderRadius: '10px' },
  suspended: { outline: '2px solid #f59e0b', outlineOffset: '3px', borderRadius: '10px' },
  skipped: { outline: '2px solid #9ca3af', outlineOffset: '3px', borderRadius: '10px', opacity: 0.5 },
};

const CANVAS_LEGEND = [
  { color: '#22c55e', label: 'Completed' },
  { color: '#ef4444', label: 'Failed' },
  { color: '#3b82f6', label: 'Running' },
  { color: '#f59e0b', label: 'Suspended' },
  { color: '#9ca3af', label: 'Skipped / Pending' },
];

function ExecutionCanvas({
  workflow,
  nodeResults,
  open,
  onClose,
}: {
  workflow: WorkflowInfo;
  nodeResults: Record<string, NodeResult>;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const rfNodes = (workflow.definition.nodes ?? []).map((n) => {
    const result = nodeResults[n.id];
    const status = result?.status;
    return {
      ...n,
      position: n.position ?? { x: 0, y: 0 },
      style: status ? STATUS_OUTLINE[status] : undefined,
      draggable: false,
      selectable: false,
      connectable: false,
    };
  });

  const rfEdges = (workflow.definition.edges ?? []).map((e) => ({
    ...e,
    style: { stroke: '#6b7280' },
  }));

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-4 z-[201] flex flex-col rounded-xl border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <span className="text-sm font-semibold">Canvas view</span>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
              {CANVAS_LEGEND.map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.12 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
            <MiniMap />
          </ReactFlow>
        </div>
      </div>
    </>,
    document.body,
  );
}

function LogSettingsDialog({
  open,
  onClose,
  workflow,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  workflow: WorkflowInfo;
  onSave: (logLevel: string, logRetentionDays: number | null) => Promise<void>;
}) {
  const [logLevel, setLogLevel] = useState(workflow.logLevel);
  const [retention, setRetention] = useState<string>(
    workflow.logRetentionDays?.toString() ?? '',
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(logLevel, retention ? parseInt(retention, 10) : null);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log collection settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Log level</label>
            <Select value={logLevel} onValueChange={(v) => setLogLevel(v as typeof logLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — no logs collected</SelectItem>
                <SelectItem value="errors">Errors only</SelectItem>
                <SelectItem value="info">Info — node completions &amp; errors</SelectItem>
                <SelectItem value="debug">Debug — all events including running</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Retention (days)
              <span className="ml-1 text-xs text-muted-foreground font-normal">optional</span>
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
              placeholder="Forever"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to keep logs forever.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ExecutionDetailPage() {
  const { podId, id } = useParams<{ podId: string; id: string }>();
  const { getToken } = useAuth();
  const { activeWorkspace, loading: wsLoading } = useWorkspace();
  const router = useRouter();

  const [execution, setExecution] = useState<Execution | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalComment, setApprovalComment] = useState('');
  const [humanAnswer, setHumanAnswer] = useState('');
  const [approving, setApproving] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [logSettingsOpen, setLogSettingsOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [timelineView, setTimelineView] = useState<'list' | 'gantt'>('list');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    if (!activeWorkspace) return null;
    try {
      const token = await getToken();
      if (!token) return null;
      const api = createApiClient(token);
      const base = `/workspaces/${activeWorkspace.id}/pods/${podId}/executions/${id}`;
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

  async function loadWorkflow(workflowId: string) {
    if (!activeWorkspace) return;
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const wf = await api.get<WorkflowInfo>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${workflowId}`,
      );
      setWorkflow(wf);
    } catch {
      // workflow may have been deleted — non-fatal
    }
  }

  useEffect(() => {
    if (wsLoading || !activeWorkspace) return;

    void loadData().then((ex) => {
      setLoading(false);
      if (ex?.workflowId) void loadWorkflow(ex.workflowId);
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
  }, [activeWorkspace, wsLoading, podId, id]);

  async function replay(fromNodeId?: string) {
    if (!activeWorkspace) return;
    setReplaying(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const newExec = await api.post<{ id: string }>(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/executions/${id}/replay`,
        fromNodeId ? { fromNodeId } : {},
      );
      router.push(`/pods/${podId}/executions/${newExec.id}`);
    } finally {
      setReplaying(false);
    }
  }

  async function respond(approved: boolean) {
    if (!activeWorkspace) return;
    setApproving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/executions/${id}/respond`,
        { approved, comment: approvalComment.trim() || undefined },
      );
      setApprovalComment('');
      void loadData();
    } finally {
      setApproving(false);
    }
  }

  async function respondWithAnswer() {
    if (!activeWorkspace || !humanAnswer.trim()) return;
    setApproving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(
        `/workspaces/${activeWorkspace.id}/pods/${podId}/executions/${id}/respond`,
        { answer: humanAnswer.trim() },
      );
      setHumanAnswer('');
      void loadData();
    } finally {
      setApproving(false);
    }
  }

  async function saveLogSettings(logLevel: string, logRetentionDays: number | null) {
    if (!activeWorkspace || !execution?.workflowId) return;
    const token = await getToken();
    if (!token) return;
    const api = createApiClient(token);
    const updated = await api.patch<WorkflowInfo>(
      `/workspaces/${activeWorkspace.id}/pods/${podId}/workflows/${execution.workflowId}/log-settings`,
      { logLevel, logRetentionDays },
    );
    setWorkflow(updated);
  }

  const nodeMap = new Map<string, WorkflowNode>(
    (workflow?.definition?.nodes ?? []).map((n) => [n.id, n]),
  );

  const pendingInterrupt = (execution?.variables as any)?.__pendingInterrupt as PendingInterrupt | undefined;
  const interruptType = pendingInterrupt?.type ?? 'approval';
  const interruptPrompt = pendingInterrupt?.question ?? pendingInterrupt?.message ?? pendingInterrupt?.prompt;

  if (loading || wsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!execution) {
    return <p className="text-sm text-muted-foreground">Execution not found.</p>;
  }

  const wallTime =
    execution.startedAt && execution.finishedAt
      ? formatDuration(
          new Date(execution.finishedAt).getTime() -
            new Date(execution.startedAt).getTime(),
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-mono text-sm text-muted-foreground">{execution.id}</h1>
        <Badge variant={STATUS_VARIANT[execution.status] ?? 'secondary'}>
          {execution.status}
        </Badge>
        {wallTime && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            {wallTime}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {workflow && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCanvasOpen(true)}
              >
                Canvas view
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogSettingsOpen(true)}
              >
                Log settings
              </Button>
            </>
          )}
          {['completed', 'failed', 'cancelled'].includes(execution.status) && (
            <Button
              variant="outline"
              size="sm"
              disabled={replaying}
              onClick={() => void replay()}
            >
              {replaying ? 'Re-running…' : 'Re-run'}
            </Button>
          )}
          {execution.workflowId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(`/pods/${podId}/workflows/${execution.workflowId!}`)
              }
            >
              Open workflow
            </Button>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Trigger</p>
          <p className="font-medium capitalize">{execution.triggeredBy}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Started</p>
          <p className="font-medium">
            {execution.startedAt
              ? new Date(execution.startedAt).toLocaleString()
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Finished</p>
          <p className="font-medium">
            {execution.finishedAt
              ? new Date(execution.finishedAt).toLocaleString()
              : execution.status === 'running'
                ? 'Running…'
                : '—'}
          </p>
        </div>
      </div>

      {/* Suspension panel */}
      {execution.status === 'suspended' && (
        <>
          <Separator />
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-4 space-y-3">
            {interruptType === 'ask_human' ? (
              <>
                <p className="text-sm font-semibold">Input required</p>
                {interruptPrompt && (
                  <p className="text-sm text-foreground">{interruptPrompt}</p>
                )}
                <Textarea
                  rows={3}
                  autoFocus
                  value={humanAnswer}
                  onChange={(e) => setHumanAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void respondWithAnswer();
                  }}
                  placeholder="Type your response…"
                  className="text-sm"
                />
                <Button
                  size="sm"
                  disabled={approving || !humanAnswer.trim()}
                  onClick={() => void respondWithAnswer()}
                >
                  {approving ? 'Submitting…' : 'Send'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Awaiting approval</p>
                <p className="text-xs text-muted-foreground">
                  This execution is paused. Review the node output above and approve or reject.
                </p>
                <Textarea
                  rows={2}
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  placeholder="Optional comment or reason…"
                  className="text-xs"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={approving}
                    onClick={() => void respond(true)}
                  >
                    {approving ? 'Submitting…' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={approving}
                    onClick={() => void respond(false)}
                  >
                    Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Node timeline + Gantt */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">Execution timeline</p>
            <div className="flex gap-0.5 rounded-md border p-0.5">
              {(['list', 'gantt'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setTimelineView(v)}
                  className={`rounded px-2.5 py-0.5 text-xs font-medium capitalize transition-colors ${timelineView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {v === 'list' ? 'List' : 'Gantt'}
                </button>
              ))}
            </div>
          </div>
          {workflow && (
            <span className="text-xs text-muted-foreground">
              Collecting: <strong>{workflow.logLevel}</strong> logs
              {workflow.logRetentionDays
                ? ` · ${workflow.logRetentionDays}d retention`
                : ' · forever'}
            </span>
          )}
        </div>
        {timelineView === 'list' ? (
          <NodeTimeline
            execution={execution}
            logs={logs}
            nodeMap={nodeMap}
            onReplayFrom={
              ['completed', 'failed', 'cancelled'].includes(execution.status)
                ? (nodeId) => void replay(nodeId)
                : undefined
            }
          />
        ) : (
          <GanttTimeline execution={execution} logs={logs} nodeMap={nodeMap} />
        )}
      </div>

      <Separator />

      {/* Input / Output */}
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
            {execution.output
              ? JSON.stringify(execution.output, null, 2)
              : execution.error ?? '—'}
          </pre>
        </div>
      </div>

      {/* Canvas view */}
      {workflow && (
        <ExecutionCanvas
          workflow={workflow}
          nodeResults={execution.nodeResults ?? {}}
          open={canvasOpen}
          onClose={() => setCanvasOpen(false)}
        />
      )}

      {/* Log settings dialog */}
      {workflow && logSettingsOpen && (
        <LogSettingsDialog
          open={logSettingsOpen}
          onClose={() => setLogSettingsOpen(false)}
          workflow={workflow}
          onSave={saveLogSettings}
        />
      )}
    </div>
  );
}
