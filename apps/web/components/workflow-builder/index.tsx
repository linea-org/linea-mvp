'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAuth } from '@clerk/nextjs';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Tick01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Spinner } from '@linea/ui/components/spinner';
import { nodeTypes } from './nodes/node-types';
import { Toolbar } from './toolbar';
import { LibraryPanel } from './panels/library-panel';
import { NodePanel } from './panels/node-panel';
import { GenerateDialog, type GenerateEvent } from './generate-dialog';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface WFNode {
  id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>;
}
interface WFEdge {
  id: string; source: string; target: string;
  sourceHandle?: string; targetHandle?: string; label?: string;
}
interface Workflow {
  id: string; name: string; description?: string;
  definition: { nodes: WFNode[]; edges: WFEdge[] }; podId: string;
}
interface WorkflowBuilderProps {
  workflowId: string; podId: string; workspaceId: string;
}

interface SSEEvent {
  type: string;
  nodeId?: string;
  status?: string;
  output?: unknown;
  error?: string;
  interrupt?: { nodeId?: string; message?: string; prompt?: string };
}

/* ------------------------------------------------------------------ */
/*  Node color map for MiniMap                                          */
/* ------------------------------------------------------------------ */
const NODE_COLORS: Record<string, string> = {
  start: '#6366f1', end: '#14b8a6', agent: '#3b82f6',
  http: '#8b5cf6', transform: '#7c3aed', 'if-else': '#f59e0b',
  router: '#ea580c', approval: '#9ca3af', mcp: '#eab308', memory: '#a855f7',
  extract: '#0ea5e9', retriever: '#10b981', guardrails: '#ef4444', code: '#64748b',
};

/* ------------------------------------------------------------------ */
/*  Inner builder (must be inside ReactFlowProvider)                   */
/* ------------------------------------------------------------------ */
function BuilderInner({ workflowId, podId, workspaceId }: WorkflowBuilderProps) {
  const { getToken } = useAuth();
  const router = useRouter();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [runStatus, setRunStatus] = useState<{ id: string; status: string } | null>(null);
  const [interrupt, setInterrupt] = useState<SSEEvent['interrupt'] | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');

  const sseAbortRef = useRef<AbortController | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  async function openGenerate() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(true);
  }

  function handleGenerateEvent(event: GenerateEvent) {
    if (event.type === 'node_added' && event.node) {
      setIsGenerating(true);
      setNodes((nds) => {
        if (nds.find((n) => n.id === event.node!.id)) return nds;
        return [
          ...nds,
          {
            id: event.node!.id,
            type: event.node!.type,
            position: event.node!.position,
            data: { ...event.node!.data },
          } as Node,
        ];
      });
    } else if (event.type === 'edge_added' && event.edge) {
      setEdges((eds) => {
        if (eds.find((e) => e.id === event.edge!.id)) return eds;
        return [
          ...eds,
          {
            id: event.edge!.id,
            source: event.edge!.source,
            target: event.edge!.target,
            sourceHandle: event.edge!.sourceHandle ?? undefined,
            label: event.edge!.label ?? undefined,
          } as Edge,
        ];
      });
    } else if (event.type === 'complete') {
      setIsGenerating(false);
      if (event.name) setWorkflowName(event.name);
      // Fit view after all nodes are on canvas
      setTimeout(() => rfInstance?.fitView({ padding: 0.2, duration: 500 }), 150);
    } else if (event.type === 'error') {
      setIsGenerating(false);
      showToast(event.message ?? 'Generation failed', 'error');
    }
  }

  // Clean up SSE on unmount
  useEffect(() => () => { sseAbortRef.current?.abort(); }, []);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function clearNodeStatuses() {
    setNodes((nds) => nds.map((n) => {
      if (!n.data.status) return n;
      const { status: _s, ...rest } = n.data as Record<string, unknown>;
      void _s;
      return { ...n, data: rest };
    }));
  }

  /* ---- Fetch workflow ------------------------------------------ */
  useEffect(() => {
    async function fetchWorkflow() {
      try {
        const token = await getToken();
        if (!token) return;
        const api = createApiClient(token);
        const wf = await api.get<Workflow>(
          `/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`,
        );
        setWorkflowName(wf.name);
        setNodes((wf.definition?.nodes ?? []).map((n) => ({
          id: n.id, type: n.type, position: n.position,
          data: { ...n.data, nodeType: n.type },
        })));
        setEdges((wf.definition?.edges ?? []).map((e) => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workflow');
      } finally {
        setLoading(false);
      }
    }
    void fetchWorkflow();
  }, [workflowId, podId, workspaceId, getToken, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: false }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelectedNode(node), []);
  const onPaneClick = useCallback(() => setSelectedNode(null), []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (!nodeType || !rfInstance || !reactFlowWrapper.current) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = rfInstance.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const id = `${nodeType}-${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      { id, type: nodeType, position, data: { nodeType, nodeName: nodeType.charAt(0).toUpperCase() + nodeType.slice(1), label: nodeType } },
    ]);
  }, [rfInstance, setNodes]);

  const handleNodeUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev);
  }, [setNodes]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`, {
        name: workflowName,
        definition: {
          nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
          edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined, label: e.label ?? undefined })),
        },
      });
      showToast('Workflow saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  /* ---- SSE handler -------------------------------------------- */
  function handleSSEEvent(evt: SSEEvent, executionId: string) {
    switch (evt.type) {
      case 'node_update':
        if (evt.nodeId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === evt.nodeId
                ? { ...n, data: { ...n.data, status: evt.status } }
                : n,
            ),
          );
        }
        break;
      case 'execution_suspended':
        setInterrupt(evt.interrupt ?? null);
        setRunStatus({ id: executionId, status: 'suspended' });
        break;
      case 'execution_complete':
        setRunStatus({ id: executionId, status: 'completed' });
        setInterrupt(null);
        showToast('Execution completed');
        break;
      case 'execution_failed':
        setRunStatus({ id: executionId, status: 'failed' });
        setInterrupt(null);
        showToast('Execution failed', 'error');
        break;
      default:
        break;
    }
  }

  async function startSSE(token: string, executionId: string) {
    sseAbortRef.current?.abort();
    const ac = new AbortController();
    sseAbortRef.current = ac;

    try {
      const resp = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/events`,
        { headers: { Authorization: `Bearer ${token}` }, signal: ac.signal },
      );
      if (!resp.ok || !resp.body) return;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as SSEEvent;
            handleSSEEvent(evt, executionId);
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // stream ended unexpectedly — status reflects last known state
    }
  }

  async function handleRun() {
    setIsRunning(true);
    sseAbortRef.current?.abort();
    setRunStatus(null);
    setInterrupt(null);
    clearNodeStatuses();

    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);

      // Collect test input from the start node
      const startNode = nodes.find((n) => n.type === 'start');
      const testInput = (startNode?.data?.testInput as Record<string, string>) ?? {};

      const ex = await api.post<{ id: string; status: string }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions`,
        { workflowId, input: testInput },
      );
      setRunStatus({ id: ex.id, status: ex.status ?? 'queued' });
      showToast('Execution started');

      // Start SSE stream (fire-and-forget — aborted on next run or unmount)
      void startSSE(token, ex.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Run failed', 'error');
    } finally {
      setIsRunning(false);
    }
  }

  async function handleApproval(approved: boolean) {
    if (!runStatus) return;
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.patch(`/workspaces/${workspaceId}/pods/${podId}/executions/${runStatus.id}/respond`, {
        approved,
      });
      setInterrupt(null);
      setRunStatus((prev) => prev ? { ...prev, status: 'running' } : prev);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Approval failed', 'error');
    }
  }

  /* ---- Loading / Error states -------------------------------- */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-6" />
          <p className="text-sm text-muted-foreground">Loading workflow…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" onClick={() => router.push(`/pods/${podId}/workflows`)}>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
          Back to workflows
        </Button>
      </div>
    );
  }

  const isSuspended = runStatus?.status === 'suspended' && !!interrupt;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/10">
      <Toolbar
        workflowName={workflowName}
        isSaving={isSaving}
        isRunning={isRunning}
        isGenerating={isGenerating}
        runStatus={runStatus}
        onSave={() => void handleSave()}
        onRun={() => void handleRun()}
        onBack={() => router.push(`/pods/${podId}/workflows`)}
        onNameChange={setWorkflowName}
        onGenerate={() => void openGenerate()}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Generate panel (slide in from left, takes priority over library) */}
        <div
          className="shrink-0 border-r border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: generateOpen ? 360 : 0 }}
        >
          {generateOpen && (
            <GenerateDialog
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              onEvent={handleGenerateEvent}
              onClose={() => { setGenerateOpen(false); setIsGenerating(false); }}
            />
          )}
        </div>

        {/* Library panel (hidden while generate panel is open) */}
        <div
          className="shrink-0 border-r border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: !generateOpen && libraryOpen ? 240 : 0 }}
        >
          {!generateOpen && libraryOpen && <LibraryPanel />}
        </div>

        {/* Library toggle — hidden while generate panel is open */}
        {!generateOpen && (
        <button
          onClick={() => setLibraryOpen((v) => !v)}
          title={libraryOpen ? 'Collapse library' : 'Expand library'}
          className="absolute top-1/2 z-20 -translate-y-1/2 flex h-10 w-5 items-center justify-center rounded-r-md border border-l-0 border-border bg-background text-muted-foreground shadow-sm transition-all hover:text-foreground"
          style={{ left: libraryOpen ? 232 : 0 }}
        >
          <HugeiconsIcon
            icon={libraryOpen ? ArrowLeft01Icon : ArrowRight01Icon}
            className="size-3"
          />
        </button>
        )}

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="relative flex-1"
          onDragOver={isGenerating ? undefined : onDragOver}
          onDrop={isGenerating ? undefined : onDrop}
        >
          {/* Read-only overlay during AI generation */}
          {isGenerating && (
            <div className="absolute inset-0 z-10 flex items-end justify-center pb-6 pointer-events-none">
              <div className="flex items-center gap-2 rounded-full border bg-background/90 px-4 py-2 shadow-lg text-sm font-medium text-violet-600 backdrop-blur-sm">
                <span className="size-2 rounded-full bg-violet-500 animate-pulse" />
                AI is building your workflow…
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={isGenerating ? undefined : onNodesChange}
            onEdgesChange={isGenerating ? undefined : onEdgesChange}
            onConnect={isGenerating ? undefined : onConnect}
            onNodeClick={isGenerating ? undefined : onNodeClick}
            onPaneClick={isGenerating ? undefined : onPaneClick}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            nodesDraggable={!isGenerating}
            nodesConnectable={!isGenerating}
            elementsSelectable={!isGenerating}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            deleteKeyCode={isGenerating ? null : 'Delete'}
            className={`bg-muted/20 ${isGenerating ? 'pointer-events-none' : ''}`}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
            <Controls />
            <MiniMap
              nodeColor={(n) => NODE_COLORS[(n.data?.nodeType as string) ?? n.type ?? ''] ?? '#d4d4d8'}
              className="rounded-lg border border-border"
            />
          </ReactFlow>
        </div>

        {/* Node config panel */}
        <div
          className="shrink-0 overflow-hidden transition-all duration-200"
          style={{ width: selectedNode ? 340 : 0 }}
        >
          {selectedNode && (
            <NodePanel
              node={selectedNode}
              nodes={nodes}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleNodeUpdate}
              onDelete={handleNodeDelete}
            />
          )}
        </div>
      </div>

      {/* Approval banner */}
      {isSuspended && (
        <div className="shrink-0 border-t border-amber-300 bg-amber-50 px-5 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Approval required
              </p>
              {(interrupt?.message || interrupt?.prompt) && (
                <p className="mt-0.5 truncate text-xs text-amber-700 dark:text-amber-300">
                  {interrupt.message ?? interrupt.prompt}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                onClick={() => void handleApproval(false)}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="mr-1 size-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => void handleApproval(true)}
              >
                <HugeiconsIcon icon={Tick01Icon} className="mr-1 size-3.5" />
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast.type === 'error' ? 'bg-destructive' : 'bg-foreground'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported component                                                  */
/* ------------------------------------------------------------------ */
export function WorkflowBuilder(props: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  );
}
