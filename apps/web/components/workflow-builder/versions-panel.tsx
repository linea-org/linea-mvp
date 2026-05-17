'use client';

import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Loading01Icon,
  ReloadIcon,
  GitBranchIcon,
  ArrowTurnBackwardIcon,
  GitCompareIcon,
} from '@hugeicons/core-free-icons';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import type { Node, Edge } from '@xyflow/react';

interface VersionEntry {
  id: string;
  version: number;
  createdBy: string | null;
  createdAt: string;
}

interface VersionDetail extends VersionEntry {
  definition: { nodes: any[]; edges: any[] };
}

interface Props {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onRestore: (nodes: Node[], edges: Edge[]) => void;
  onDiff?: (version: number) => void;
  onClose: () => void;
}

export function VersionsPanel({ workspaceId, podId, workflowId, token, onRestore, onDiff, onClose }: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => { void fetchVersions(); }, []);

  async function fetchVersions() {
    setLoading(true);
    try {
      const api = createApiClient(token);
      const data = await api.get<VersionEntry[]>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/versions`,
      );
      setVersions(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(version: number) {
    setRestoring(version);
    try {
      const api = createApiClient(token);
      const data = await api.get<VersionDetail>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/versions/${version}`,
      );
      const rawNodes = (data.definition?.nodes ?? []).map((n: any) => ({
        id: n.id, type: n.type, position: n.position,
        data: { ...n.data, nodeType: n.type },
        ...(n.style ? { style: n.style } : {}),
        ...(n.parentId ? { parentId: n.parentId, extent: 'parent' as const } : {}),
        ...(n.type === 'note' ? { connectable: false } : {}),
        ...(n.type === 'frame' ? { connectable: false, selectable: true, zIndex: n.zIndex ?? -1 } : {}),
      }));
      const restoredNodes: Node[] = [
        ...rawNodes.filter((n: any) => n.type === 'frame'),
        ...rawNodes.filter((n: any) => n.type !== 'frame'),
      ];
      const restoredEdges: Edge[] = (data.definition?.edges ?? []).map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
      }));
      onRestore(restoredNodes, restoredEdges);
      onClose();
    } catch {
      // ignore
    } finally {
      setRestoring(null);
    }
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Version History</p>
          <p className="text-[11px] text-muted-foreground">Restore a previous snapshot</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={() => void fetchVersions()} title="Refresh">
            <HugeiconsIcon icon={ReloadIcon} className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Loading01Icon} className="size-3.5 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <HugeiconsIcon icon={GitBranchIcon} className="size-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No saved versions yet.</p>
            <p className="text-[11px] text-muted-foreground/70 max-w-44">
              Versions are created each time you save the workflow.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    v{v.version}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(v.createdAt)}</p>
                  <p className="text-[10px] text-muted-foreground/60 truncate">
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onDiff && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      title={`Compare v${v.version} with current`}
                      onClick={() => onDiff(v.version)}
                    >
                      <HugeiconsIcon icon={GitCompareIcon} className="size-3 mr-1" />
                      Diff
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    title={`Restore v${v.version}`}
                    disabled={restoring === v.version}
                    onClick={() => void handleRestore(v.version)}
                  >
                    {restoring === v.version ? (
                      <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />
                    ) : (
                      <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3 mr-1" />
                    )}
                    {restoring === v.version ? '' : 'Restore'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
