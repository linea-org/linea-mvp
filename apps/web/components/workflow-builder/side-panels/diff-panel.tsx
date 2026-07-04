"use client"

import { useState, useEffect, useMemo } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Loading01Icon,
  CheckmarkCircle01Icon,
  Add01Icon,
  Delete01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Dialog, DialogContent, DialogTitle } from "@linea/ui/components/dialog"
import { createApiClient } from "@/lib/api"
import { nodeTypes } from "./nodes/node-types"

type DiffStatus = "added" | "removed" | "changed" | "unchanged"

const DIFF_RING: Record<DiffStatus, React.CSSProperties> = {
  added: {
    outline: "2px solid #10b981",
    outlineOffset: "2px",
    borderRadius: "10px",
  },
  removed: {
    outline: "2px solid #ef4444",
    outlineOffset: "2px",
    borderRadius: "10px",
    opacity: 0.45,
  },
  changed: {
    outline: "2px solid #f59e0b",
    outlineOffset: "2px",
    borderRadius: "10px",
  },
  unchanged: {},
}

const DIFF_EDGE_STYLE: Record<
  "added" | "removed" | "unchanged",
  React.CSSProperties
> = {
  added: { stroke: "#10b981", strokeWidth: 2 },
  removed: { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "6 3" },
  unchanged: { stroke: "hsl(var(--border))" },
}

interface RawNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  style?: React.CSSProperties
}
interface RawEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

interface DiffResult {
  diffNodes: Array<{ node: Node; status: DiffStatus }>
  rfEdges: Edge[]
  addedCount: number
  removedCount: number
  changedCount: number
  addedEdges: number
  removedEdges: number
}

function computeDiff(
  currentNodes: Node[],
  currentEdges: Edge[],
  oldNodes: RawNode[],
  oldEdges: RawEdge[]
): DiffResult {
  const currentMap = new Map(currentNodes.map((n) => [n.id, n]))
  const oldMap = new Map(oldNodes.map((n) => [n.id, n]))

  const diffNodes: Array<{ node: Node; status: DiffStatus }> = []

  for (const n of currentNodes) {
    const old = oldMap.get(n.id)
    if (!old) {
      diffNodes.push({ node: n, status: "added" })
    } else {
      const same =
        n.type === old.type &&
        JSON.stringify(n.data) === JSON.stringify(old.data)
      diffNodes.push({ node: n, status: same ? "unchanged" : "changed" })
    }
  }

  for (const n of oldNodes) {
    if (!currentMap.has(n.id)) {
      diffNodes.push({
        node: {
          id: n.id,
          type: n.type,
          position: n.position,
          data: { ...n.data, nodeType: n.type },
          draggable: false,
          selectable: false,
          connectable: false,
        } as Node,
        status: "removed",
      })
    }
  }

  const oldEdgeIds = new Set(oldEdges.map((e) => e.id))
  const currentEdgeIds = new Set(currentEdges.map((e) => e.id))

  const rfEdges: Edge[] = [
    ...currentEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      label: e.label ?? undefined,
      style: oldEdgeIds.has(e.id)
        ? DIFF_EDGE_STYLE.unchanged
        : DIFF_EDGE_STYLE.added,
      animated: !oldEdgeIds.has(e.id),
    })),
    ...oldEdges
      .filter((e) => !currentEdgeIds.has(e.id))
      .map(
        (e) =>
          ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: e.label,
            style: DIFF_EDGE_STYLE.removed,
          }) as Edge
      ),
  ]

  return {
    diffNodes,
    rfEdges,
    addedCount: diffNodes.filter((d) => d.status === "added").length,
    removedCount: diffNodes.filter((d) => d.status === "removed").length,
    changedCount: diffNodes.filter((d) => d.status === "changed").length,
    addedEdges: currentEdges.filter((e) => !oldEdgeIds.has(e.id)).length,
    removedEdges: oldEdges.filter((e) => !currentEdgeIds.has(e.id)).length,
  }
}

/* ---- Fit-on-load inner canvas -------------------------------- */
function DiffCanvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const id = setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 80)
    return () => clearTimeout(id)
  }, [fitView, nodes.length])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      className="bg-muted/10"
    />
  )
}

/* ---- Main component ------------------------------------------ */
interface DiffPanelProps {
  workspaceId: string
  podId: string
  workflowId: string
  token: string
  currentNodes: Node[]
  currentEdges: Edge[]
  targetVersion: number
  onClose: () => void
}

export function DiffPanel({
  workspaceId,
  podId,
  workflowId,
  token,
  currentNodes,
  currentEdges,
  targetVersion,
  onClose,
}: DiffPanelProps) {
  const [loading, setLoading] = useState(true)
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchAndDiff()
  }, [targetVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAndDiff() {
    setLoading(true)
    setError(null)
    try {
      const api = createApiClient(token)
      const data = await api.get<{
        definition: { nodes: RawNode[]; edges: RawEdge[] }
      }>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/versions/${targetVersion}`
      )
      const result = computeDiff(
        currentNodes,
        currentEdges,
        data.definition?.nodes ?? [],
        data.definition?.edges ?? []
      )
      setDiff(result)
    } catch {
      setError("Failed to load version data.")
    } finally {
      setLoading(false)
    }
  }

  const rfNodes: Node[] = useMemo(() => {
    if (!diff) return []
    return diff.diffNodes.map(({ node, status }) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: { ...node.data, nodeType: node.type },
      style: { ...(node.style ?? {}), ...DIFF_RING[status] },
      draggable: false,
      selectable: false,
      connectable: false,
    }))
  }, [diff])

  const isClean =
    diff &&
    diff.addedCount === 0 &&
    diff.removedCount === 0 &&
    diff.changedCount === 0 &&
    diff.addedEdges === 0 &&
    diff.removedEdges === 0

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="flex h-[90vh] max-w-[96vw] gap-0 overflow-hidden p-0 sm:max-w-[96vw]">
        {/* Left sidebar */}
        <div className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
          <div className="shrink-0 border-b border-border px-3 py-2.5">
            <DialogTitle className="text-sm leading-tight font-semibold">
              Compare versions
            </DialogTitle>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Current vs v{targetVersion}
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-3">
            {/* Legend */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Legend
              </p>
              {[
                { color: "#10b981", label: "Added" },
                { color: "#ef4444", label: "Removed" },
                { color: "#f59e0b", label: "Changed" },
                { color: "hsl(var(--border))", label: "Unchanged" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            {/* Summary counts */}
            {diff && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Changes
                </p>
                {isClean ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      className="size-3.5"
                    />
                    No changes
                  </div>
                ) : (
                  <div className="space-y-1">
                    {diff.addedCount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-green-600">
                          <HugeiconsIcon icon={Add01Icon} className="size-3" />
                          Added nodes
                        </div>
                        <span className="font-mono font-semibold text-green-600">
                          {diff.addedCount}
                        </span>
                      </div>
                    )}
                    {diff.removedCount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-red-500">
                          <HugeiconsIcon
                            icon={Delete01Icon}
                            className="size-3"
                          />
                          Removed nodes
                        </div>
                        <span className="font-mono font-semibold text-red-500">
                          {diff.removedCount}
                        </span>
                      </div>
                    )}
                    {diff.changedCount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <HugeiconsIcon
                            icon={RefreshIcon}
                            className="size-3"
                          />
                          Modified nodes
                        </div>
                        <span className="font-mono font-semibold text-amber-500">
                          {diff.changedCount}
                        </span>
                      </div>
                    )}
                    {diff.addedEdges > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Added edges</span>
                        <span className="font-mono text-green-600">
                          {diff.addedEdges}
                        </span>
                      </div>
                    )}
                    {diff.removedEdges > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Removed edges</span>
                        <span className="font-mono text-red-500">
                          {diff.removedEdges}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Changed node list */}
            {diff && !isClean && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  Affected nodes
                </p>
                <div className="space-y-0.5">
                  {diff.diffNodes
                    .filter((d) => d.status !== "unchanged")
                    .map(({ node, status }) => {
                      const name =
                        (node.data?.nodeName as string) ??
                        (node.data?.label as string) ??
                        node.type ??
                        node.id
                      const dotColor =
                        status === "added"
                          ? "#10b981"
                          : status === "removed"
                            ? "#ef4444"
                            : "#f59e0b"
                      return (
                        <div
                          key={node.id}
                          className="flex items-center gap-2 py-0.5"
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span
                            className="truncate text-[11px] text-foreground"
                            title={name}
                          >
                            {name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/60 capitalize">
                            {status}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1">
          {/* Header bar */}
          <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-3 py-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-full bg-foreground/50" />
                Current
              </div>
              <span className="text-[11px] text-muted-foreground">vs</span>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-full border border-muted-foreground/40" />
                v{targetVersion}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="absolute inset-0 pt-9">
            {loading && (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={Loading01Icon}
                  className="size-4 animate-spin"
                />
                Loading v{targetVersion}...
              </div>
            )}
            {error && (
              <div className="flex h-full items-center justify-center text-xs text-destructive">
                {error}
              </div>
            )}
            {!loading && !error && diff && (
              <ReactFlowProvider>
                <DiffCanvas nodes={rfNodes} edges={diff.rfEdges} />
              </ReactFlowProvider>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
