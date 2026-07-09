"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Panel,
  Background,
  Controls,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/hooks/use-api-client"
import { toast } from "@linea/ui/components/sonner"

import { nodeTypes } from "./nodes/node-types"
import { Toolbar } from "./toolbar"
import { LibraryPanel } from "./panels/library-panel"
import { NodePanel } from "./panels/node-panel/node-panel"
import type { WorkflowBuilderProps } from "./workflow-builder.types"
import { useWorkflowStore } from "./use-workflow-store"
import {
  Workflow,
  PRIMARY_NODE_OUTPUT,
  WorkflowNodeType,
} from "@linea/shared/contracts"

function BuilderInner({
  workflowId,
  podId,
  workspaceId,
}: WorkflowBuilderProps) {
  const getApi = useApiClient()

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    pushHistory,
    undo,
    redo,
  } = useWorkflowStore()

  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [workflowName, setWorkflowName] = useState("Untitled Workflow")

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const seededWorkflowRef = useRef(false)

  const {
    data: wf,
    isLoading: loading,
    error: workflowQueryError,
  } = useQuery({
    queryKey: ["workflow-full-definition", workspaceId, podId, workflowId],
    queryFn: async () => {
      const api = await getApi()
      return api.get<Workflow>(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`
      )
    },
  })
  useEffect(() => {
    if (!wf || seededWorkflowRef.current) return

    seededWorkflowRef.current = true
    setWorkflowName(wf.name)

    const rawNodes: Node[] = (wf.definition?.nodes ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      position: n.metadata?.position ?? { x: 0, y: 0 },
      data: {
        ...n.config,
        nodeType: n.type,
      },
    }))

    const loadedNodes: Node[] = [...rawNodes]

    if (!loadedNodes.some((n) => n.type === "start")) {
      loadedNodes.unshift({
        id: "start-1",
        type: "start",
        position: { x: 100, y: 200 },
        data: { nodeType: "start" },
      })
    }

    if (!loadedNodes.some((n) => n.type === "end")) {
      loadedNodes.push({
        id: "end-1",
        type: "end",
        position: { x: 800, y: 200 },
        data: { nodeType: "end" },
      })
    }

    const loadedEdges: Edge[] = [
      {
        id: `xy-edge__start-1-${wf.definition?.startNode}`,
        source: "start-1",
        target: wf.definition?.startNode || "",
      },
      ...(wf.definition?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.id,
      })),
    ]

    setNodes(loadedNodes)
    setEdges(loadedEdges)

    pushHistory()

    setTimeout(() => {
      rfInstance?.fitView({
        padding: 0.25,
        duration: 300,
      })
    }, 100)
  }, [wf, setNodes, setEdges, pushHistory, rfInstance])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      const mod = navigator.platform.toUpperCase().includes("MAC")
        ? e.metaKey
        : e.ctrlKey

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }

      if (!inInput) {
        if (e.key === "Escape") {
          setSelectedNode(null)
          return
        }
        if (e.key === "f" || e.key === "F") {
          rfInstance?.fitView({ padding: 0.25, duration: 300 })
          return
        }
        if ((e.key === "Delete" || e.key === "Backspace") && selectedNode) {
          e.preventDefault()
          setNodes((ns) => ns.filter((n) => n.id !== selectedNode.id))
          setEdges((es) =>
            es.filter(
              (e2) =>
                e2.source !== selectedNode.id && e2.target !== selectedNode.id
            )
          )
          setSelectedNode(null)
          return
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, rfInstance, selectedNode, setNodes, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])
  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const nodeType = e.dataTransfer.getData("nodeType")
      if (!nodeType || !rfInstance || !reactFlowWrapper.current) return

      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      })
      const id = `${nodeType}-${Date.now()}`
      const isFrame = nodeType === "frame"

      const newNode: Node = {
        id,
        type: nodeType,
        position,
        data: isFrame
          ? {
              frameName: "Group",
              frameColor: "#6366f1",
              collapsed: false,
              expandedHeight: 220,
            }
          : {
              nodeType,
              nodeName: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
              label: nodeType,
            },
        ...(nodeType === "note" ? { connectable: false } : {}),
        ...(isFrame
          ? {
              connectable: false,
              selectable: true,
              zIndex: -1,
              style: { width: 300, height: 220 },
            }
          : {}),
      }

      setNodes((nds) => {
        const newNodes = [...nds, newNode]
        return newNodes
      })
      // Delay pushHistory slightly to allow nodes state to update
      setTimeout(() => pushHistory(), 0)
    },
    [rfInstance, setNodes, pushHistory]
  )

  const handleUpdateNode = useCallback(
    (id: string, dataUpdates: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...dataUpdates } } : n
        )
      )
      pushHistory()

      // Update selected node locally if it's the one being edited
      setSelectedNode((prev) =>
        prev?.id === id
          ? { ...prev, data: { ...prev.data, ...dataUpdates } }
          : prev
      )
    },
    [setNodes, pushHistory]
  )

  const serializeNodeData = (node: Node) => {
    switch (node.type) {
      case "agent": {
        const { nodeType, nodeName, label, portsVertical, ...config } =
          node.data

        return config
      }

      case "transform": {
        const { nodeType, nodeName, label, portsVertical, ...config } =
          node.data

        return config
      }

      case "http": {
        const { nodeType, nodeName, label, portsVertical, ...config } =
          node.data

        return config
      }
    }
  }
  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id))
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
      if (selectedNode?.id === id) {
        setSelectedNode(null)
      }
      pushHistory()
    },
    [setNodes, setEdges, selectedNode, pushHistory]
  )

  const handleSave = useCallback(async () => {
    try {
      const api = await getApi()
      const realNodes = nodes.filter((n) =>
        ["agent", "transform", "http"].includes(n.type!)
      )
      const startNodeObj = nodes.find((n) => n.type === "start")

      const startEdge = edges.find((e) => e.source === startNodeObj?.id)

      const startNode = startEdge?.target ?? ""

      const realNodeIds = new Set(realNodes.map((n) => n.id))

      const def = {
        startNode,
        nodes: realNodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: sanitizeConfig(n, realNodes, edges, serializeNodeData(n)),
        })),
        edges: edges
          .filter((e) => realNodeIds.has(e.source) && realNodeIds.has(e.target))
          .map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          })),
      }

      await api.patch(
        `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`,
        {
          name: workflowName,
          definition: def,
        },
        "v2"
      )
      toast.success("Workflow saved successfully")
    } catch (err) {
      console.error(err)
      toast.error("Failed to save workflow")
    }
  }, [getApi, nodes, edges, workspaceId, podId, workflowId, workflowName])

  function sanitizeConfig(
    node: Node,
    nodes: Node[],
    edges: Edge[],
    config: unknown
  ): unknown {
    const incoming = edges.find((e) => e.target === node.id)

    if (!incoming) {
      return config
    }

    const sourceNode = nodes.find((n) => n.id === incoming.source)

    if (!sourceNode?.type) {
      return config
    }

    const sourceType = sourceNode.type as WorkflowNodeType

    const prefix = [
      "nodeResults",
      incoming.source,
      ...PRIMARY_NODE_OUTPUT[sourceType],
    ].join(".")

    return replaceLastOutput(config, prefix)
  }

  function replaceLastOutput(value: unknown, prefix: string): unknown {
    if (typeof value === "string") {
      return value.replace(
        /\{\{\s*lastOutput(\.[^}]*)?\s*\}\}/g,
        (_, path = "") => `{{${prefix}${path}}}`
      )
    }

    if (Array.isArray(value)) {
      return value.map((v) => replaceLastOutput(v, prefix))
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, replaceLastOutput(v, prefix)])
      )
    }

    return value
  }

  const handleRun = useCallback(async () => {
    try {
      await handleSave()
      const api = await getApi()
      await api.post(
        `/workspaces/${workspaceId}/pods/${podId}/executions`,
        {
          workflowId,
        },
        "v2"
      )
      toast.success("Execution started")
    } catch (err) {
      console.error(err)
      toast.error("Failed to start execution")
    }
  }, [getApi, handleSave, workspaceId, podId, workflowId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="mb-4 inline-block size-8 animate-spin rounded-full border-4 border-primary border-r-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">
            Loading workflow...
          </p>
        </div>
      </div>
    )
  }

  if (workflowQueryError) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load workflow
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <div className="flex h-full flex-1 overflow-hidden">
        {/* Left Library Panel */}
        <div
          className={`shrink-0 border-r border-border transition-all duration-300 ease-in-out ${
            libraryOpen ? "w-64 opacity-100" : "w-0 overflow-hidden opacity-0"
          }`}
        >
          <LibraryPanel />
        </div>

        {/* Canvas Area */}
        <div className="relative flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            fitView
            deleteKeyCode={["Backspace", "Delete"]}
            className="bg-muted/10"
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap
              zoomable
              pannable
              className="rounded-lg border border-border bg-background shadow-sm"
            />

            <Panel position="top-left" className="m-4">
              <Toolbar
                workflowName={workflowName}
                libraryOpen={libraryOpen}
                setLibraryOpen={setLibraryOpen}
                onSave={handleSave}
                onRun={handleRun}
              />
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Settings Panel */}
        {selectedNode && (
          <div className="w-80 shrink-0 border-l border-border bg-background shadow-xl">
            <NodePanel
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
              workspaceId={workspaceId}
              podId={podId}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  )
}

export default WorkflowBuilder
