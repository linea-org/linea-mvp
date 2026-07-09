"use client"

import { useState, useEffect, useRef } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Delete01Icon,
  Settings01Icon,
  FlowConnectionIcon,
  NoteAddIcon,
  AiBrain01Icon,
  RepeatIcon,
  Loading01Icon,
} from "@hugeicons/core-free-icons"

import type { Node, Edge } from "@xyflow/react"
import { Button } from "@linea/ui/components/button"
import { Input } from "@linea/ui/components/input"
import { useApiClient } from "@/hooks/use-api-client"
import { ScrollArea } from "@linea/ui/components/scroll-area"
import { Separator } from "@linea/ui/components/separator"
import type { NodeResult } from "../../workflow-builder.types"
import { AgentPanel } from "../ai/agent-panel"
import { HttpPanel } from "../integrations/http-panel"
import { TransformPanel } from "../data/transform-panel"
import { StartPanel } from "../workflow-meta/start-panel"
import { nodeTypeLabels, nodeTypeColors } from "./node-type-meta"
import { ConnectionsTab } from "./connections-tab"
import { DocumentTab } from "./node-docs"

interface NodePanelProps {
  node: Node | null
  onClose: () => void
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
  nodes: Node[]
  edges: Edge[]
  nodeResult?: NodeResult
  workspaceId?: string
  podId?: string
  executionId?: string
  onRetry?: () => void
}

type PanelTab = "editor" | "connections" | "document"

export function NodePanel({
  node,
  onClose,
  onUpdate,
  onDelete,
  nodes,
  edges,
  nodeResult,
  workspaceId,
  podId,
  executionId,
  onRetry,
}: NodePanelProps) {
  const getApi = useApiClient()
  const [activeTab, setActiveTab] = useState<PanelTab>("editor")
  const [editingName, setEditingName] = useState(false)
  const [localName, setLocalName] = useState(
    () => (node?.data.nodeName as string) ?? (node?.data.label as string) ?? ""
  )
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [debugResponse, setDebugResponse] = useState<string | null>(null)
  const [debugLoading, setDebugLoading] = useState(false)

  async function fetchDebugExplanation() {
    if (!workspaceId || !podId || !executionId || !node || !nodeResult?.error)
      return
    setDebugLoading(true)
    setDebugResponse(null)
    try {
      const api = await getApi()
      const data = await api.post<{ explanation?: string }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/debug-node`,
        {
          nodeId: node.id,
          nodeType: (node.data.nodeType as string) ?? node.type,
          nodeData: node.data,
          error: nodeResult.error,
        }
      )
      setDebugResponse(data.explanation ?? "No explanation returned.")
    } catch {
      setDebugResponse(
        "Could not reach the AI debug endpoint. Ensure the workflow has been deployed and try again."
      )
    } finally {
      setDebugLoading(false)
    }
  }

  useEffect(() => {
    if (editingName) nameInputRef.current?.select()
  }, [editingName])

  if (!node) return null

  const nodeType = (node.data.nodeType as string) ?? node.type ?? "agent"
  const typeLabel = nodeTypeLabels[nodeType] ?? nodeType
  const badgeColor = nodeTypeColors[nodeType] ?? "#6366f1"
  const nodeData = node.data as Record<string, unknown>

  function commitName() {
    const trimmed = localName.trim()
    if (trimmed) onUpdate(node!.id, { nodeName: trimmed })
    setEditingName(false)
  }

  function handleUpdate(fields: Record<string, unknown>) {
    onUpdate(node!.id, fields)
  }

  function renderSubPanel() {
    switch (nodeType) {
      case "agent":
        return (
          <AgentPanel
            data={nodeData}
            onUpdate={handleUpdate}
            nodes={nodes}
            nodeId={node!.id}
          />
        )
      case "http":
        return (
          <HttpPanel
            data={nodeData}
            onUpdate={handleUpdate}
            nodes={nodes}
            nodeId={node!.id}
          />
        )
      case "transform":
        return <TransformPanel data={nodeData} onUpdate={handleUpdate} />
      case "start":
        return <StartPanel data={nodeData} onUpdate={handleUpdate} />
      case "note":
        return (
          <p className="text-xs text-muted-foreground">
            Double-click the note on the canvas to edit its text.
          </p>
        )
      case "end":
        return (
          <p className="text-xs text-muted-foreground">
            The End node marks workflow termination. No configuration needed.
          </p>
        )
      default:
        return null
    }
  }

  const TABS: Array<{
    id: PanelTab
    icon: typeof Settings01Icon
    title: string
  }> = [
    { id: "editor", icon: Settings01Icon, title: "Editor" },
    { id: "connections", icon: FlowConnectionIcon, title: "Connections" },
    { id: "document", icon: NoteAddIcon, title: "Document" },
  ]

  return (
    <div className="flex h-full flex-row border-l border-border bg-background">
      <div className="flex shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/20 px-1 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              activeTab === tab.id
                ? "border border-border bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
          >
            <HugeiconsIcon icon={tab.icon} className="size-4" />
          </button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 space-y-2 border-b border-border p-3">
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase"
              style={{ backgroundColor: badgeColor }}
            >
              {typeLabel}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="destructive"
                title="Delete node"
                onClick={() => {
                  onDelete(node.id)
                  onClose()
                }}
              >
                <HugeiconsIcon icon={Delete01Icon} />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Close"
                onClick={onClose}
              >
                <HugeiconsIcon icon={Cancel01Icon} />
              </Button>
            </div>
          </div>

          {editingName ? (
            <Input
              ref={nameInputRef}
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName()
                if (e.key === "Escape") setEditingName(false)
              }}
              className="h-7 text-sm font-semibold"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              title="Click to rename"
              className="block w-full cursor-text truncate text-left text-sm font-semibold text-foreground hover:text-muted-foreground"
            >
              {localName || typeLabel}
            </button>
          )}
        </div>

        {activeTab === "editor" && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="mr-2 space-y-4 px-3 py-3">
              {renderSubPanel()}

              {nodeType !== "start" &&
                nodeType !== "end" &&
                nodeType !== "note" &&
                nodeType !== "frame" && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          Continue on fail
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          Skip errors and let the workflow continue
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={!!nodeData.continueOnFail}
                        onClick={() =>
                          handleUpdate({
                            continueOnFail: !nodeData.continueOnFail,
                          })
                        }
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none ${
                          nodeData.continueOnFail
                            ? "bg-foreground"
                            : "bg-muted-foreground/30"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-3.5 rounded-full bg-background shadow-sm transition-transform ${
                            nodeData.continueOnFail
                              ? "translate-x-4"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </>
                )}

              {nodeResult && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                        Last Run
                      </p>
                      <div className="flex items-center gap-1.5">
                        {nodeResult.durationMs !== undefined && (
                          <span className="text-[10px] text-muted-foreground">
                            {nodeResult.durationMs}ms
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold capitalize ${
                            nodeResult.status === "completed"
                              ? "text-green-600"
                              : nodeResult.status === "failed"
                                ? "text-red-500"
                                : nodeResult.status === "running"
                                  ? "text-blue-500"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {nodeResult.status}
                        </span>
                      </div>
                    </div>

                    {nodeResult.status === "failed" && (
                      <div className="flex gap-1.5">
                        {onRetry && (
                          <button
                            onClick={onRetry}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <HugeiconsIcon
                              icon={RepeatIcon}
                              className="size-3"
                            />
                            Retry node
                          </button>
                        )}
                        {executionId && (
                          <button
                            onClick={() => void fetchDebugExplanation()}
                            disabled={debugLoading}
                            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          >
                            {debugLoading ? (
                              <HugeiconsIcon
                                icon={Loading01Icon}
                                className="size-3 animate-spin"
                              />
                            ) : (
                              <HugeiconsIcon
                                icon={AiBrain01Icon}
                                className="size-3"
                              />
                            )}
                            Why did this fail?
                          </button>
                        )}
                      </div>
                    )}

                    {nodeResult.error && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/30">
                        <p className="mb-1 text-[10px] font-semibold tracking-wider text-red-600 uppercase">
                          Error
                        </p>
                        <pre className="font-mono text-[11px] break-all whitespace-pre-wrap text-red-700 dark:text-red-400">
                          {nodeResult.error}
                        </pre>
                      </div>
                    )}

                    {debugResponse && (
                      <div className="rounded-md border border-violet-200 bg-violet-50 p-2 dark:border-violet-900 dark:bg-violet-950/30">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <HugeiconsIcon
                            icon={AiBrain01Icon}
                            className="size-3 shrink-0 text-violet-500"
                          />
                          <p className="text-[10px] font-semibold tracking-wider text-violet-600 uppercase">
                            AI Analysis
                          </p>
                        </div>
                        <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-violet-800 dark:text-violet-300">
                          {debugResponse}
                        </p>
                      </div>
                    )}

                    {nodeResult.output !== undefined && !nodeResult.error && (
                      <div className="rounded-md border border-border bg-muted/40 p-2">
                        <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                          Output
                        </p>
                        <pre className="max-h-48 overflow-y-auto font-mono text-[11px] break-all whitespace-pre-wrap text-foreground">
                          {typeof nodeResult.output === "string"
                            ? nodeResult.output
                            : JSON.stringify(nodeResult.output, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        {activeTab === "connections" && (
          <ScrollArea className="min-h-0 flex-1">
            <ConnectionsTab node={node} nodes={nodes} edges={edges} />
          </ScrollArea>
        )}

        {activeTab === "document" && (
          <DocumentTab node={node} className="min-h-0 flex-1" />
        )}
      </div>
    </div>
  )
}
