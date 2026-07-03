'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Loading01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import type { Node } from '@xyflow/react';
import type { NodeResult } from '../workflow-builder.types';
import type { ValidationState } from '../toolbar';
import { friendlyApiError, unwrapList } from '@/lib/api';
import { useApiClient } from '@/hooks/use-api-client';
import { toast } from '@linea/ui/components/sonner';
import { StatusIcon, statusColor, statusLabel, formatRunTime, type Log } from './bottom-panel-shared';
import { LogsTab } from './logs-tab';
import { TimelineTab } from './timeline-tab';
import { IssuesTab } from './issues-tab';
import { VariablesTab } from './variables-tab';

interface Props {
  nodes: Node[];
  nodeResults: Record<string, NodeResult>;
  validationState: ValidationState;
  runStatus: { id: string; status: string } | null;
  workspaceId: string;
  podId: string;
  workflowId?: string;
  onRetryNode?: (nodeId: string) => void;
  executionOutput?: unknown;
  streamingTokens?: Record<string, string>;
}

type BottomTab = 'logs' | 'timeline' | 'issues' | 'variables';

interface HistoryEntry {
  id: string;
  status: string;
  createdAt: string;
}

export function BottomPanel({ nodes, nodeResults, validationState, runStatus, workspaceId, podId, workflowId, onRetryNode, executionOutput, streamingTokens }: Props) {
  const getApi = useApiClient();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomTab>('logs');
  const [panelHeight, setPanelHeight] = useState(200);
  const [logs, setLogs] = useState<Log[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  // historyIdx=0 is the most recent run — the list is kept newest-first.
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
  const autoOpenLogsRef = useRef(autoOpenLogs);
  autoOpenLogsRef.current = autoOpenLogs;
  const runStatusRef = useRef(runStatus);
  runStatusRef.current = runStatus;
  const dropdownRef = useRef<HTMLDivElement>(null);

  function toggleAutoOpenLogs() {
    setAutoOpenLogs((v) => {
      const next = !v;
      try { localStorage.setItem('linea:logs:auto-open', String(next)); } catch { /* ignore */ }
      return next;
    });
  }

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

  const fetchLogs = useCallback(async (execId: string) => {
    setLogsLoading(true);
    try {
      const api = await getApi();
      const data = await api.get<Log[]>(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${execId}/logs`,
      );
      setLogs(data);
    } catch (err) {
      toast.error(friendlyApiError(err));
    } finally {
      setLogsLoading(false);
    }
  }, [getApi, workspaceId, podId]);

  const fetchHistory = useCallback(async () => {
    if (!workflowId) return;
    try {
      const api = await getApi();
      const data = await api.get<HistoryEntry[] | { executions: HistoryEntry[] }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions?workflowId=${workflowId}&limit=20`,
      );
      setHistoryList(unwrapList(data, 'executions'));
    } catch (err) {
      toast.error(friendlyApiError(err));
    }
  }, [getApi, workspaceId, podId, workflowId]);

  useEffect(() => {
    if (runStatus?.id && runStatus.id !== prevStartedId.current) {
      prevStartedId.current = runStatus.id;
      setLogs([]);
      setHistoryIdx(0);
      // Prepend the new run so it appears in the list right away, before fetchHistory() resolves.
      setHistoryList((prev) => {
        if (prev.some((e) => e.id === runStatus.id)) return prev;
        return [{ id: runStatus.id, status: runStatus.status, createdAt: new Date().toISOString() }, ...prev];
      });
      if (autoOpenLogsRef.current) { setActiveTab('logs'); setOpen(true); }
    }
  }, [runStatus?.id, runStatus?.status]);

  useEffect(() => {
    const id = runStatus?.id;
    const status = runStatus?.status;
    const isDone = status === 'completed' || status === 'failed';
    if (id && isDone && id !== prevRunId.current) {
      prevRunId.current = id;
      setActiveTab('logs');
      setOpen(true);
      setLogs([]);
      void fetchLogs(id);
      // Optimistic update so the dropdown doesn't show "running" while fetchHistory() is in flight.
      setHistoryList((prev) =>
        prev.map((e) => e.id === id ? { ...e, status: status! } : e),
      );
      void fetchHistory();
    }
  }, [runStatus?.status, runStatus?.id, fetchLogs, fetchHistory]);

  useEffect(() => {
    const isRunning = runStatus?.status === 'running' || runStatus?.status === 'queued';
    if (!isRunning || !runStatus?.id) return;
    const id = runStatus.id;
    const interval = setInterval(() => void fetchLogs(id), 2000);
    return () => clearInterval(interval);
  }, [runStatus?.id, runStatus?.status, fetchLogs]);

  useEffect(() => {
    if (runStatusRef.current || didLoadHistory.current || !workflowId) return;
    didLoadHistory.current = true;
    void fetchHistory();
  }, [workflowId, fetchHistory]);

  useEffect(() => {
    if (runStatusRef.current) return;
    const entry = historyList[historyIdx];
    if (!entry) return;
    prevRunId.current = entry.id;
    prevStartedId.current = entry.id;
    setLogs([]);
    void fetchLogs(entry.id);
  }, [historyIdx, historyList, fetchLogs]);

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

  // Fall back to the currently-viewed history entry when no run is active.
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
          onClick={toggleAutoOpenLogs}
          title={autoOpenLogs ? 'Logs auto-open on run: on' : 'Logs auto-open on run: off'}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mr-1"
        >
          <span className={`size-1.5 rounded-full shrink-0 ${autoOpenLogs ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
          auto-open
        </button>

        {isRunning && (
          <div className="flex items-center gap-1.5 mr-2">
            <HugeiconsIcon icon={Loading01Icon} className="size-3 text-blue-500 animate-spin" />
            <span className="text-[11px] font-medium text-blue-500">Running</span>
          </div>
        )}

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
