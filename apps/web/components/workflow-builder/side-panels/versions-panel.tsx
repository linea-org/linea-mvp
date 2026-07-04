"use client"

<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
import { useState, useEffect } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
=======
import { useMutation, useQuery } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx
import {
  Cancel01Icon,
  Loading01Icon,
  ReloadIcon,
  GitBranchIcon,
  ArrowTurnBackwardIcon,
  GitCompareIcon,
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
} from "@hugeicons/core-free-icons"
import { createApiClient } from "@/lib/api"
import { Button } from "@linea/ui/components/button"
import { ScrollArea } from "@linea/ui/components/scroll-area"
import type { Node, Edge } from "@xyflow/react"
=======
} from '@hugeicons/core-free-icons';
import { useApiClient } from '@/hooks/use-api-client';
import { Button } from '@linea/ui/components/button';
import { ScrollArea } from '@linea/ui/components/scroll-area';
import { Spinner } from '@linea/ui/components/spinner';
import type { Node, Edge } from '@xyflow/react';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx

interface VersionEntry {
  id: string
  version: number
  createdBy: string | null
  createdAt: string
}

interface VersionDetail extends VersionEntry {
  definition: { nodes: any[]; edges: any[] }
}

interface Props {
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
  workspaceId: string
  podId: string
  workflowId: string
  token: string
  onRestore: (nodes: Node[], edges: Edge[]) => void
  onDiff?: (version: number) => void
  onClose: () => void
}

export function VersionsPanel({
  workspaceId,
  podId,
  workflowId,
  token,
  onRestore,
  onDiff,
  onClose,
}: Props) {
  const [versions, setVersions] = useState<VersionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<number | null>(null)

  useEffect(() => {
    void fetchVersions()
  }, [])

  async function fetchVersions() {
    setLoading(true)
    try {
      const api = createApiClient(token)
      const data = await api.get<VersionEntry[]>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/versions`
      )
      setVersions(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(version: number) {
    setRestoring(version)
    try {
      const api = createApiClient(token)
=======
  workspaceId: string;
  podId: string;
  workflowId: string;
  onRestore: (nodes: Node[], edges: Edge[]) => void;
  onDiff?: (version: number) => void;
  onClose: () => void;
}

export function VersionsPanel({ workspaceId, podId, workflowId, onRestore, onDiff, onClose }: Props) {
  const getApi = useApiClient();

  const { data: versions = [], isLoading: loading, refetch } = useQuery<VersionEntry[]>({
    queryKey: ['workflow-versions', workspaceId, podId, workflowId],
    queryFn: async () => {
      const api = await getApi();
      return api.get<VersionEntry[]>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/versions`);
    },
  });

  function fetchVersions() {
    void refetch();
  }

  const restoreMutation = useMutation({
    mutationFn: async (version: number) => {
      const api = await getApi();
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx
      const data = await api.get<VersionDetail>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/versions/${version}`
      )
      const rawNodes = (data.definition?.nodes ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { ...n.data, nodeType: n.type },
        ...(n.style ? { style: n.style } : {}),
        ...(n.parentId
          ? { parentId: n.parentId, extent: "parent" as const }
          : {}),
        ...(n.type === "note" ? { connectable: false } : {}),
        ...(n.type === "frame"
          ? { connectable: false, selectable: true, zIndex: n.zIndex ?? -1 }
          : {}),
      }))
      const restoredNodes: Node[] = [
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
        ...rawNodes.filter((n: any) => n.type === "frame"),
        ...rawNodes.filter((n: any) => n.type !== "frame"),
      ]
      const restoredEdges: Edge[] = (data.definition?.edges ?? []).map(
        (e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
        })
      )
      onRestore(restoredNodes, restoredEdges)
      onClose()
    } catch {
      // ignore
    } finally {
      setRestoring(null)
    }
  }
=======
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
      return { restoredNodes, restoredEdges };
    },
    onSuccess: ({ restoredNodes, restoredEdges }) => {
      onRestore(restoredNodes, restoredEdges);
      onClose();
    },
  });
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">Version History</p>
          <p className="text-[11px] text-muted-foreground">
            Restore a previous snapshot
          </p>
        </div>
        <div className="flex items-center gap-1">
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void fetchVersions()}
            title="Refresh"
          >
=======
          <Button size="icon-sm" variant="ghost" onClick={fetchVersions} title="Refresh">
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx
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
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
            <HugeiconsIcon
              icon={Loading01Icon}
              className="size-3.5 animate-spin"
            />
=======
            <Spinner className="size-3.5" />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <HugeiconsIcon
              icon={GitBranchIcon}
              className="size-5 text-muted-foreground/40"
            />
            <p className="text-xs text-muted-foreground">
              No saved versions yet.
            </p>
            <p className="max-w-44 text-[11px] text-muted-foreground/70">
              Versions are created each time you save the workflow.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-muted/30"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    v{v.version}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {timeAgo(v.createdAt)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground/60">
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {onDiff && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      title={`Compare v${v.version} with current`}
                      onClick={() => onDiff(v.version)}
                    >
                      <HugeiconsIcon
                        icon={GitCompareIcon}
                        className="mr-1 size-3"
                      />
                      Diff
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    title={`Restore v${v.version}`}
                    disabled={restoreMutation.isPending && restoreMutation.variables === v.version}
                    onClick={() => restoreMutation.mutate(v.version)}
                  >
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
                    {restoring === v.version ? (
                      <HugeiconsIcon
                        icon={Loading01Icon}
                        className="size-3 animate-spin"
                      />
=======
                    {restoreMutation.isPending && restoreMutation.variables === v.version ? (
                      <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin" />
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx
                    ) : (
                      <HugeiconsIcon
                        icon={ArrowTurnBackwardIcon}
                        className="mr-1 size-3"
                      />
                    )}
<<<<<<< HEAD:apps/web/components/workflow-builder/versions-panel.tsx
                    {restoring === v.version ? "" : "Restore"}
=======
                    {restoreMutation.isPending && restoreMutation.variables === v.version ? '' : 'Restore'}
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117)):apps/web/components/workflow-builder/side-panels/versions-panel.tsx
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
