'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Toolbar, type ValidationState } from './toolbar';
import { LibraryPanel } from './panels/library-panel';
import { NodePanel } from './panels/node-panel';
import { GenerateDialog, type GenerateEvent } from './generate-dialog';
import { ExecutionLogsDrawer } from './execution-logs-drawer';
import { WebhookPanel } from './webhook-panel';
import { HistoryPanel } from './history-panel';
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
  durationMs?: number;
  interrupt?: { nodeId?: string; message?: string; prompt?: string };
}

export interface NodeResult {
  status: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

/* ------------------------------------------------------------------ */
/*  Node color map for MiniMap                                          */
/* ------------------------------------------------------------------ */
const NODE_COLORS: Record<string, string> = {
  start: '#6366f1', end: '#14b8a6', agent: '#3b82f6',
  http: '#8b5cf6', transform: '#7c3aed', 'if-else': '#f59e0b',
  router: '#ea580c', approval: '#9ca3af', mcp: '#eab308', memory: '#a855f7',
  extract: '#0ea5e9', retriever: '#10b981', guardrails: '#ef4444', code: '#64748b',
  loop: '#0891b2', parallel: '#6366f1', wait: '#64748b', variables: '#059669',
  evaluator: '#d97706', subworkflow: '#7c3aed',
  slack: '#4a154b', github: '#1f2328', notion: '#37352f', gmail: '#ea4335',
};

/* ------------------------------------------------------------------ */
/*  Validation                                                          */
/* ------------------------------------------------------------------ */
function getValidationState(nodes: Node[], edges: Edge[]): ValidationState {
  const issues: string[] = [];
  let level: ValidationState['level'] = 'success';

  const hasStart = nodes.some((n) => n.type === 'start');
  const actionNodes = nodes.filter((n) => n.type !== 'start' && n.type !== 'end');

  // Hard errors — block run
  if (!hasStart) {
    issues.push('Missing Start node');
    level = 'error';
  }
  if (nodes.length > 0 && actionNodes.length === 0) {
    issues.push('Add at least one action node (Agent, HTTP, etc.)');
    level = 'error';
  }

  if (level !== 'error') {
    // Start has no outgoing edge
    const startNode = nodes.find((n) => n.type === 'start');
    if (startNode && actionNodes.length > 0 && !edges.some((e) => e.source === startNode.id)) {
      issues.push('Start node is not connected to anything');
      level = 'warning';
    }

    // Floating action nodes
    const connectedIds = new Set([...edges.map((e) => e.source), ...edges.map((e) => e.target)]);
    const floating = actionNodes.filter((n) => !connectedIds.has(n.id));
    if (floating.length > 0) {
      const label = floating.length === 1
        ? `"${(floating[0]!.data?.nodeName as string) ?? floating[0]!.type}" is not connected`
        : `${floating.length} nodes are not connected`;
      issues.push(label);
      if (level === 'success') level = 'warning';
    }

    // Branching nodes need both true/false outputs wired
    const branchingNodes = nodes.filter((n) => n.type === 'if-else' || n.type === 'router');
    for (const bn of branchingNodes) {
      const hasTrue  = edges.some((e) => e.source === bn.id && e.sourceHandle === 'true');
      const hasFalse = edges.some((e) => e.source === bn.id && e.sourceHandle === 'false');
      if (!hasTrue || !hasFalse) {
        const name = (bn.data?.nodeName as string) ?? bn.type;
        const missing = !hasTrue && !hasFalse ? 'True & False branches' : !hasTrue ? 'True branch' : 'False branch';
        issues.push(`"${name}" missing ${missing}`);
        if (level === 'success') level = 'warning';
      }
    }
  }

  return { level, issues };
}

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
  const [nodeResults, setNodeResults] = useState<Record<string, NodeResult>>({});
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);

  const validationState = useMemo(() => getValidationState(nodes, edges), [nodes, edges]);

  const sseAbortRef = useRef<AbortController | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

  // Stable refs so keyboard handler never captures stale closures
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});
  const handleRunRef  = useRef<() => Promise<void>>(async () => {});

  async function openGenerate() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setWebhookOpen(false);
    setHistoryOpen(false);
    setGenerateOpen(true);
  }

  async function openWebhook() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setHistoryOpen(false);
    setWebhookOpen((v) => !v);
  }

  async function openHistory() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setWebhookOpen(false);
    setHistoryOpen((v) => !v);
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

  // Keep auth token fresh
  useEffect(() => {
    void getToken().then((t) => { if (t) setAuthToken(t); });
  }, [getToken]);

  // Clean up SSE on unmount
  useEffect(() => () => { sseAbortRef.current?.abort(); }, []);

  // Keyboard shortcuts (builder-scoped)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      const mod = navigator.platform.toUpperCase().includes('MAC') ? e.metaKey : e.ctrlKey;

      if (mod && e.key === 's') { e.preventDefault(); void handleSaveRef.current(); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); void handleRunRef.current(); return; }
      if (e.key === 'Escape' && !inInput) {
        setSelectedNode(null);
        setWebhookOpen(false);
        setHistoryOpen(false);
        setGenerateOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function clearNodeStatuses() {
    setNodeResults({});
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
        if ((wf as any).deployedAt) setIsDeployed(true);
        const loadedNodes: Node[] = (wf.definition?.nodes ?? []).map((n) => ({
          id: n.id, type: n.type, position: n.position,
          data: { ...n.data, nodeType: n.type },
          ...(n.type === 'note' ? { connectable: false } : {}),
        }));
        // Ensure every workflow has a Start node
        if (loadedNodes.length === 0) {
          loadedNodes.push({
            id: 'start-1', type: 'start',
            position: { x: 200, y: 200 },
            data: { nodeType: 'start' },
          });
        }
        setNodes(loadedNodes);
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
      { id, type: nodeType, position, data: { nodeType, nodeName: nodeType.charAt(0).toUpperCase() + nodeType.slice(1), label: nodeType }, ...(nodeType === 'note' ? { connectable: false } : {}) },
    ]);
  }, [rfInstance, setNodes]);

  const handleNodeUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev);
  }, [setNodes]);

  function handleExport() {
    const definition = { nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label })) };
    const blob = new Blob([JSON.stringify({ name: workflowName, definition }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${workflowName.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string) as { name?: string; definition?: { nodes: WFNode[]; edges: WFEdge[] } };
          const def = parsed.definition ?? (parsed as unknown as { nodes: WFNode[]; edges: WFEdge[] });
          if (!Array.isArray(def.nodes)) throw new Error('Invalid workflow JSON');
          if (parsed.name) setWorkflowName(parsed.name);
          setNodes(def.nodes.map((n) => ({ ...n, selected: false })) as Node[]);
          setEdges((def.edges ?? []) as Edge[]);
          showToast('Workflow imported', 'success');
        } catch {
          showToast('Invalid workflow file', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

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
  // Keep keyboard shortcut refs fresh every render
  handleSaveRef.current = handleSave;

  async function handleDeploy() {
    setIsDeploying(true);
    try {
      await handleSave();
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.post(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/deploy`, {});
      setIsDeployed(true);
      showToast('Workflow deployed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deploy failed', 'error');
    } finally {
      setIsDeploying(false);
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
          setNodeResults((prev) => ({
            ...prev,
            [evt.nodeId!]: {
              status: evt.status ?? 'unknown',
              output: evt.output,
              error: evt.error,
              durationMs: evt.durationMs,
            },
          }));
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

  function validateWorkflow(): string | null {
    if (nodes.length === 0) return 'Add at least one node to run the workflow';
    if (!nodes.some((n) => n.type === 'start')) return 'A Start node is required to run the workflow';
    const nonStartNodes = nodes.filter((n) => n.type !== 'start' && n.type !== 'end');
    if (nonStartNodes.length === 0) return 'Add at least one action node (Agent, HTTP, etc.) to run';
    return null;
  }

  async function handleRun() {
    handleRunRef.current = handleRun;
    const validationError = validateWorkflow();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

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
      localStorage.setItem('linea_gs_run', 'true');
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
        isDeploying={isDeploying}
        isDeployed={isDeployed}
        runStatus={runStatus}
        validationState={validationState}
        webhookOpen={webhookOpen}
        historyOpen={historyOpen}
        onSave={() => void handleSave()}
        onRun={() => void handleRun()}
        onDeploy={() => void handleDeploy()}
        onBack={() => router.push(`/pods/${podId}/workflows`)}
        onNameChange={setWorkflowName}
        onGenerate={() => void openGenerate()}
        onWebhook={() => void openWebhook()}
        onHistory={() => void openHistory()}
        onExport={handleExport}
        onImport={handleImport}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Library panel */}
        <div
          className="shrink-0 border-r border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: libraryOpen ? 240 : 0 }}
        >
          {libraryOpen && <LibraryPanel />}
        </div>

        {/* Library toggle */}
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
            fitViewOptions={{ padding: 0.4, maxZoom: 0.85 }}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode={isGenerating ? null : ['Delete', 'Backspace']}
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

        {/* Node config panel (right side) */}
        <div
          className="shrink-0 border-l border-border overflow-hidden transition-all duration-200"
          style={{ width: selectedNode && !generateOpen && !webhookOpen && !historyOpen ? 340 : 0 }}
        >
          {selectedNode && !generateOpen && !webhookOpen && !historyOpen && (
            <NodePanel
              node={selectedNode}
              nodes={nodes}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleNodeUpdate}
              onDelete={handleNodeDelete}
              nodeResult={nodeResults[selectedNode.id]}
            />
          )}
        </div>

        {/* Generate panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: generateOpen ? 400 : 0 }}
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

        {/* Webhook panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: webhookOpen ? 320 : 0 }}
        >
          {webhookOpen && (
            <WebhookPanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              onClose={() => setWebhookOpen(false)}
            />
          )}
        </div>

        {/* History panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: historyOpen ? 400 : 0 }}
        >
          {historyOpen && (
            <HistoryPanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              nodes={nodes}
              onClose={() => setHistoryOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Execution logs drawer */}
      {runStatus && authToken && (
        <ExecutionLogsDrawer
          executionId={runStatus.id}
          workspaceId={workspaceId}
          podId={podId}
          status={runStatus.status}
          token={authToken}
          nodes={nodes}
        />
      )}

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
