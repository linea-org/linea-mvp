'use client';

import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { LayoutTable01Icon } from '@hugeicons/core-free-icons';
import { Spinner } from '@linea/ui/components/spinner';
import type { Node } from '@xyflow/react';
import type { NodeResult } from '../../workflow-builder.types';
import type { Log } from './bottom-panel-shared';

interface TimelineEntry {
  id: string;
  name: string;
  status: string;
  startedAt: number;
  durationMs: number;
}

export function TimelineTab({
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
        <Spinner className="size-3.5 text-blue-500" />
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
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Execution Timeline
          </p>
          <span className="text-[10px] text-muted-foreground font-mono">{totalLabel} total</span>
        </div>

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
