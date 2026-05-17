'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAuth } from '@clerk/nextjs';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon, ArrowRight01Icon, Tick01Icon, Cancel01Icon, Alert02Icon,
  Copy01Icon, LockKeyIcon, SquareLock01Icon, Delete01Icon,
  PlayIcon, BorderAll01Icon, ArrowDown01Icon, ArrowUp01Icon,
  Cursor01Icon, HandGrabIcon,
  Add01Icon, MinusSignIcon, FitToScreenIcon, Mouse01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@linea/ui/components/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@linea/ui/components/tooltip';
import { Kbd } from '@linea/ui/components/kbd';
import { createApiClient } from '@/lib/api';
import { Button } from '@linea/ui/components/button';
import { Spinner } from '@linea/ui/components/spinner';
import { nodeTypes } from './nodes/node-types';
import { Toolbar, type ValidationState } from './toolbar';
import { LibraryPanel } from './panels/library-panel';
import { NodePanel } from './panels/node-panel';
import { GenerateDialog, type GenerateEvent } from './generate-dialog';
import { BottomPanel } from './panels/bottom-panel';
import { DeployPanel } from './deploy-panel';
import { HistoryPanel } from './history-panel';
import { VersionsPanel } from './versions-panel';
import { DiffPanel } from './diff-panel';
import { SharePanel } from './share-panel';
import { CommentsPanel } from './comments-panel';
import { EvalsPanel } from './evals-panel';
import { useRouter } from 'next/navigation';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface WFNode {
  id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown>;
  style?: Record<string, unknown>;
  parentId?: string;
  extent?: string;
  zIndex?: number;
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

type EvalOperator = 'equals' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt';
interface EvalTestCase {
  id: string;
  name: string;
  input: string;
  assertions: { path: string; operator: EvalOperator; expected: string }[];
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
  startedAt?: number;
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
  filter: '#06b6d4', merge: '#8b5cf6', datetime: '#0d9488',
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

    // if-else nodes need both true/false outputs wired
    const ifElseNodes = nodes.filter((n) => n.type === 'if-else');
    for (const bn of ifElseNodes) {
      const hasTrue  = edges.some((e) => e.source === bn.id && e.sourceHandle === 'true');
      const hasFalse = edges.some((e) => e.source === bn.id && e.sourceHandle === 'false');
      if (!hasTrue || !hasFalse) {
        const name = (bn.data?.nodeName as string) ?? bn.type;
        const missing = !hasTrue && !hasFalse ? 'True & False branches' : !hasTrue ? 'True branch' : 'False branch';
        issues.push(`"${name}" missing ${missing}`);
        if (level === 'success') level = 'warning';
      }
    }

    // router nodes need at least one route wired
    const routerNodes = nodes.filter((n) => n.type === 'router');
    for (const rn of routerNodes) {
      const hasAnyRoute = edges.some((e) => e.source === rn.id);
      if (!hasAnyRoute) {
        const name = (rn.data?.nodeName as string) ?? 'Router';
        issues.push(`"${name}" has no routes connected`);
        if (level === 'success') level = 'warning';
      }
    }
  }

  return { level, issues };
}

/* ------------------------------------------------------------------ */
/*  Auto-layout (BFS, left-to-right, height-aware)                     */
/* ------------------------------------------------------------------ */
const NODE_W_DEFAULT = 220;
const NODE_H_DEFAULT = 80;
const H_GAP = 80;  // horizontal gap between columns
const V_GAP = 24;  // vertical gap between nodes in the same column

function computeAutoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  // Build adjacency list
  const adj: Record<string, string[]> = {};
  for (const n of nodes) adj[n.id] = [];
  for (const e of edges) adj[e.source]?.push(e.target);

  // BFS from start node to assign column (level)
  const startNode = nodes.find((n) => n.type === 'start') ?? nodes[0]!;
  const levels: Record<string, number> = { [startNode.id]: 0 };
  const queue = [startNode.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj[cur] ?? []) {
      if (levels[next] === undefined) { levels[next] = levels[cur]! + 1; queue.push(next); }
    }
  }
  // Append unreachable nodes after the last reachable level
  let maxL = Math.max(0, ...Object.values(levels));
  for (const n of nodes) { if (levels[n.id] === undefined) levels[n.id] = ++maxL; }

  // Group nodes by column
  const byLevel: Record<number, Node[]> = {};
  for (const n of nodes) { (byLevel[levels[n.id]!] ??= []).push(n); }

  // Measure each node's actual rendered height (fall back to default)
  const nodeH = (n: Node) => (n.measured?.height as number | undefined) ?? NODE_H_DEFAULT;
  const nodeW = (n: Node) => (n.measured?.width as number | undefined) ?? NODE_W_DEFAULT;

  // Compute column x positions based on the widest node in each preceding column
  const sortedLevels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
  const colX: Record<number, number> = {};
  let curX = 80;
  for (const lv of sortedLevels) {
    colX[lv] = curX;
    const colWidth = Math.max(...byLevel[lv]!.map(nodeW));
    curX += colWidth + H_GAP;
  }

  // Within each column: stack nodes vertically, centered around y=300
  const positioned = new Map<string, { x: number; y: number }>();
  for (const lv of sortedLevels) {
    const col = byLevel[lv]!;
    const totalH = col.reduce((sum, n) => sum + nodeH(n), 0) + V_GAP * (col.length - 1);
    let y = 300 - totalH / 2;
    for (const n of col) {
      positioned.set(n.id, { x: colX[lv]!, y });
      y += nodeH(n) + V_GAP;
    }
  }

  return nodes.map((n) => ({ ...n, position: positioned.get(n.id) ?? n.position }));
}

/* ------------------------------------------------------------------ */
/*  Canvas toolbar (inside ReactFlow, so useReactFlow() works)         */
/* ------------------------------------------------------------------ */
function CanvasControls({
  cursorMode,
  setCursorMode,
  isInteractive,
  onInteractiveToggle,
}: {
  cursorMode: 'select' | 'grab';
  setCursorMode: (m: 'select' | 'grab') => void;
  isInteractive: boolean;
  onInteractiveToggle: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  type CtrlBtn = { icon: typeof Add01Icon; label: string; shortcut?: string; action: () => void; active?: boolean };
  const sections: Array<CtrlBtn[] | null> = [
    [
      { icon: HandGrabIcon,  label: 'Pan mode',    shortcut: 'G', action: () => setCursorMode('grab'),   active: cursorMode === 'grab'   },
      { icon: Cursor01Icon,  label: 'Select mode', shortcut: 'V', action: () => setCursorMode('select'), active: cursorMode === 'select' },
    ],
    null,
    [
      { icon: Add01Icon,       label: 'Zoom in',  action: () => zoomIn({ duration: 200 })  },
      { icon: MinusSignIcon,   label: 'Zoom out', action: () => zoomOut({ duration: 200 }) },
      { icon: FitToScreenIcon, label: 'Fit view', shortcut: 'F', action: () => fitView({ padding: 0.25, duration: 300 }) },
    ],
    null,
    [
      {
        icon: isInteractive ? Mouse01Icon : LockKeyIcon,
        label: isInteractive ? 'Lock canvas' : 'Unlock canvas',
        action: onInteractiveToggle,
        active: !isInteractive,
      },
    ],
  ];

  return (
    <Panel position="bottom-left" className="!m-2">
      <TooltipProvider delayDuration={400}>
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-background/95 shadow-md backdrop-blur-sm">
          {sections.map((section, si) =>
            section === null ? (
              <div key={si} className="mx-1.5 h-px bg-border" />
            ) : (
              section.map((btn, bi) => (
                <Tooltip key={`${si}-${bi}`}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={btn.action}
                      className={`flex size-8 items-center justify-center transition-colors ${
                        btn.active
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <HugeiconsIcon icon={btn.icon} className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="flex items-center gap-2">
                    {btn.label}
                    {btn.shortcut && <Kbd>{btn.shortcut}</Kbd>}
                  </TooltipContent>
                </Tooltip>
              ))
            ),
          )}
        </div>
      </TooltipProvider>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Inner builder (must be inside ReactFlowProvider)                   */
/* ------------------------------------------------------------------ */
function BuilderInner({ workflowId, podId, workspaceId }: WorkflowBuilderProps) {
  const { getToken, userId } = useAuth();
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
  const [deployPanelOpen, setDeployPanelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [evalsOpen, setEvalsOpen] = useState(false);
  const [deployedAt, setDeployedAt] = useState<string | null>(null);
  const [diffVersion, setDiffVersion] = useState<number | null>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: string; onConfirm: () => void } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: Node } | null>(null);
  const [editingEdge, setEditingEdge] = useState<{ id: string; x: number; y: number; label: string } | null>(null);
  const [testNodeDialog, setTestNodeDialog] = useState<{ node: Node } | null>(null);
  const [testNodeInput, setTestNodeInput] = useState('{}');
  const [testNodeRunning, setTestNodeRunning] = useState(false);
  const [cursorMode, setCursorMode] = useState<'select' | 'grab'>('grab');
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [isInteractive, setIsInteractive] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [testCases, setTestCases] = useState<EvalTestCase[]>([]);

  // Undo/redo history
  const historyStackRef = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const historyIdxRef = useRef(-1);
  const [isDeployed, setIsDeployed] = useState(false);

  const validationState = useMemo(() => getValidationState(nodes, edges), [nodes, edges]);

  // Keep refs in sync for stable closures (auto-layout, history)
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const sseAbortRef = useRef<AbortController | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Stable refs so keyboard handler never captures stale closures
  const handleSaveRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});
  const handleRunRef  = useRef<() => Promise<void>>(async () => {});

  async function openGenerate() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setDeployPanelOpen(false);
    setHistoryOpen(false);
    setVersionsOpen(false);
    setShareOpen(false);
    setGenerateOpen(true);
  }

  async function openDeployPanel() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setHistoryOpen(false);
    setVersionsOpen(false);
    setShareOpen(false);
    setDeployPanelOpen((v) => !v);
  }

  async function openHistory() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setDeployPanelOpen(false);
    setVersionsOpen(false);
    setShareOpen(false);
    setHistoryOpen((v) => !v);
  }

  async function openVersions() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setDeployPanelOpen(false);
    setHistoryOpen(false);
    setShareOpen(false);
    setVersionsOpen((v) => !v);
  }

  async function openShare() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setDeployPanelOpen(false);
    setHistoryOpen(false);
    setVersionsOpen(false);
    setShareOpen((v) => !v);
  }

  async function openEvals() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setGenerateOpen(false);
    setDeployPanelOpen(false);
    setHistoryOpen(false);
    setVersionsOpen(false);
    setShareOpen(false);
    setCommentsOpen(false);
    setEvalsOpen((v) => !v);
  }

  async function openComments() {
    const token = await getToken();
    if (token) setAuthToken(token);
    setCommentsOpen((v) => !v);
  }

  function handleVersionRestore(restoredNodes: Node[], restoredEdges: Edge[]) {
    setNodes(restoredNodes);
    setEdges(restoredEdges);
    showToast('Version restored — save to make it current');
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

  // Auto-save interval (30s when enabled)
  useEffect(() => {
    if (!autoSave) return;
    const id = setInterval(() => void handleSaveRef.current({ silent: true }), 30_000);
    return () => clearInterval(id);
  }, [autoSave]);

  // Use a ref so the handler always sees fresh state/closures without re-registering
  const builderKeyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  builderKeyHandlerRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const mod = navigator.platform.toUpperCase().includes('MAC') ? e.metaKey : e.ctrlKey;

    // ── Modifier shortcuts (always active) ─────────────────────────────────
    if (mod && e.key === 's') { e.preventDefault(); void handleSaveRef.current(); return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); void handleRunRef.current(); return; }
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }
    if (mod && e.key === 'g') { e.preventDefault(); void openGenerate(); return; }
    if (mod && e.key === 'l') { e.preventDefault(); handleAutoLayout(); return; }
    if (mod && e.key === "'") { e.preventDefault(); void openComments(); return; }
    if (mod && e.key === 'f') { e.preventDefault(); setSearchOpen((v) => !v); setSearchQuery(''); return; }
    if (mod && e.key === 'k' && !e.shiftKey) return; // handled globally

    // ── Non-input single-key shortcuts ──────────────────────────────────────
    if (!inInput) {
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); setSearchQuery(''); return; }
        setSelectedNode(null);
        setDeployPanelOpen(false);
        setHistoryOpen(false);
        setVersionsOpen(false);
        setShareOpen(false);
        setGenerateOpen(false);
        setCommentsOpen(false);
        setEvalsOpen(false);
        return;
      }
      if (e.key === 'f' || e.key === 'F') { rfInstance?.fitView({ padding: 0.25, duration: 300 }); return; }
      if (e.key === 'g') { setCursorMode('grab'); return; }
      if (e.key === 'v') { setCursorMode('select'); return; }
      if (e.key === 'a' && !mod) { handleAutoLayout(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
        e.preventDefault();
        setNodes((ns) => ns.filter((n) => n.id !== selectedNode.id));
        setEdges((es) => es.filter((e2) => e2.source !== selectedNode.id && e2.target !== selectedNode.id));
        setSelectedNode(null);
        return;
      }
    }
  };

  // Keyboard shortcuts (builder-scoped)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { builderKeyHandlerRef.current(e); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function pushHistory(ns: Node[], es: Edge[]) {
    historyStackRef.current = historyStackRef.current.slice(0, historyIdxRef.current + 1);
    historyStackRef.current.push({ nodes: ns.map((n) => ({ ...n })), edges: es.map((e) => ({ ...e })) });
    historyIdxRef.current = historyStackRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }

  function handleUndo() {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const snap = historyStackRef.current[historyIdxRef.current]!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }

  function handleRedo() {
    if (historyIdxRef.current >= historyStackRef.current.length - 1) return;
    historyIdxRef.current++;
    const snap = historyStackRef.current[historyIdxRef.current]!;
    setNodes(snap.nodes);
    setEdges(snap.edges);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyStackRef.current.length - 1);
  }

  function handleAutoLayout() {
    const positioned = computeAutoLayout(nodesRef.current, edgesRef.current);
    setNodes(positioned);
    pushHistory(positioned, edgesRef.current);
    setTimeout(() => rfInstance?.fitView({ padding: 0.25, duration: 400 }), 50);
  }

  function handleAutoSaveToggle() {
    setAutoSave((v) => !v);
  }

  function clearNodeStatuses() {
    setNodeResults({});
    setNodes((nds) => nds.map((n) => {
      const { status: _s, _outputPreview: _op, ...rest } = n.data as Record<string, unknown>;
      void _s; void _op;
      if (!n.data.status && !n.data._outputPreview) return n;
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
        if ((wf as any).deployedAt) {
          setIsDeployed(true);
          setDeployedAt((wf as any).deployedAt as string);
        }
        const savedAutoSave = localStorage.getItem(`linea:autosave:${workflowId}`);
        if (savedAutoSave === 'true') setAutoSave(true);
        const rawNodes = (wf.definition?.nodes ?? []).map((n) => ({
          id: n.id, type: n.type, position: n.position,
          data: { ...n.data, nodeType: n.type },
          ...(n.style ? { style: n.style } : {}),
          ...(n.parentId ? { parentId: n.parentId, extent: 'parent' as const } : {}),
          ...(n.type === 'note' ? { connectable: false } : {}),
          ...(n.type === 'frame' ? { connectable: false, selectable: true, zIndex: n.zIndex ?? -1 } : {}),
        }));
        // Frames must come before their children so ReactFlow renders them behind
        const loadedNodes: Node[] = [
          ...rawNodes.filter((n) => n.type === 'frame'),
          ...rawNodes.filter((n) => n.type !== 'frame'),
        ];
        // Ensure every workflow has a Start node
        if (loadedNodes.length === 0) {
          loadedNodes.push({
            id: 'start-1', type: 'start',
            position: { x: 200, y: 200 },
            data: { nodeType: 'start' },
          });
        }
        setNodes(loadedNodes);
        const loadedEdges = (wf.definition?.edges ?? []).map((e) => ({
          id: e.id, source: e.source, target: e.target,
          sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label,
        }));
        setEdges(loadedEdges);
        // Load saved test cases
        const savedCases = (wf.definition as any)?.settings?.testCases as EvalTestCase[] | undefined;
        if (Array.isArray(savedCases)) setTestCases(savedCases);
        // Seed undo history with the loaded state
        historyStackRef.current = [{ nodes: loadedNodes, edges: loadedEdges }];
        historyIdxRef.current = 0;
        setCanUndo(false);
        setCanRedo(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workflow');
      } finally {
        setLoading(false);
      }
    }
    void fetchWorkflow();
  }, [workflowId, podId, workspaceId, getToken, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => {
      const newEdges = addEdge({ ...params, animated: false }, eds);
      pushHistory(nodesRef.current, newEdges);
      return newEdges;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setContextMenu(null);
  }, []);
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

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
    const isFrame = nodeType === 'frame';
    const newNode: Node = {
      id,
      type: nodeType,
      position,
      data: isFrame
        ? { frameName: 'Group', frameColor: '#6366f1', collapsed: false, expandedHeight: 220 }
        : { nodeType, nodeName: nodeType.charAt(0).toUpperCase() + nodeType.slice(1), label: nodeType },
      ...(nodeType === 'note' ? { connectable: false } : {}),
      ...(isFrame ? { connectable: false, selectable: true, zIndex: -1, style: { width: 400, height: 220 } } : {}),
    };
    setNodes((nds) => {
      // Frames go at the start of the array so they render behind all other nodes
      const next = isFrame ? [newNode, ...nds] : [...nds, newNode];
      pushHistory(next, edgesRef.current);
      return next;
    });
  }, [rfInstance, setNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodeUpdate = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n));
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev);
  }, [setNodes]);

  function handleExport() {
    const definition = {
      nodes: nodes.map((n) => ({
        id: n.id, type: n.type, position: n.position, data: n.data,
        ...(n.style ? { style: n.style as Record<string, unknown> } : {}),
        ...(n.parentId ? { parentId: n.parentId } : {}),
        ...(n.extent ? { extent: String(n.extent) } : {}),
        ...(n.zIndex !== undefined ? { zIndex: n.zIndex } : {}),
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label })),
    };
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
          setNodes(def.nodes.map((n) => ({
            ...n, selected: false,
            data: { ...n.data, nodeType: n.type },
            ...(n.parentId ? { parentId: n.parentId, extent: 'parent' as const } : {}),
            ...(n.type === 'note' ? { connectable: false } : {}),
            ...(n.type === 'frame' ? { connectable: false, selectable: true, zIndex: n.zIndex ?? -1 } : {}),
          })) as Node[]);
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
    setNodes((nds) => {
      const target = nds.find((n) => n.id === nodeId);
      if (target?.data?.deleteLocked) return nds;
      let updated = nds;
      if (target?.type === 'frame') {
        updated = nds.map((n) => {
          if (n.parentId !== nodeId) return n;
          return {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: { x: n.position.x + target.position.x, y: n.position.y + target.position.y },
          };
        });
      }
      const next = updated.filter((n) => n.id !== nodeId);
      const nextEdges = edgesRef.current.filter((e) => e.source !== nodeId && e.target !== nodeId);
      setEdges(nextEdges);
      pushHistory(next, nextEdges);
      return next;
    });
    setSelectedNode(null);
  }, [setNodes, setEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Context menu actions ─────────────────────────────────────── */
  function duplicateNode(node: Node) {
    const newNode: Node = {
      ...node,
      id: `${node.type ?? 'node'}-${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data },
      selected: false,
    };
    setNodes((prev) => {
      const next = [...prev, newNode];
      pushHistory(next, edgesRef.current);
      return next;
    });
    setContextMenu(null);
  }

  function toggleNodePositionLock(node: Node) {
    const isLocked = node.data.positionLocked as boolean | undefined;
    setNodes((prev) => prev.map((n) =>
      n.id === node.id
        ? { ...n, draggable: isLocked ? undefined : false, data: { ...n.data, positionLocked: !isLocked } }
        : n,
    ));
    setContextMenu(null);
  }

  function toggleNodeDeletionLock(node: Node) {
    setNodes((prev) => prev.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, deleteLocked: !n.data.deleteLocked } } : n,
    ));
    setContextMenu(null);
  }

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  /* ── Edge label editing ───────────────────────────────────────── */
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((e, edge) => {
    setEditingEdge({ id: edge.id, x: e.clientX, y: e.clientY, label: String(edge.label ?? '') });
  }, []);

  function commitEdgeLabel() {
    if (!editingEdge) return;
    const hasLabel = editingEdge.label.trim().length > 0;
    setEdges((eds) => eds.map((e) => e.id === editingEdge.id ? {
      ...e,
      label: hasLabel ? editingEdge.label.trim() : undefined,
      labelStyle: hasLabel ? { fontSize: 11, fontFamily: 'inherit', fill: 'hsl(var(--foreground))' } : undefined,
      labelBgStyle: hasLabel ? { fill: 'hsl(var(--background))', stroke: 'hsl(var(--border))', strokeWidth: 1 } : undefined,
      labelBgPadding: hasLabel ? [6, 3] as [number, number] : undefined,
      labelBgBorderRadius: hasLabel ? 4 : undefined,
    } : e));
    setEditingEdge(null);
  }

  /* ── Multi-select operations ──────────────────────────────────── */
  function duplicateSelected() {
    const selected = nodes.filter((n) => n.selected);
    const newNodes = selected.map((n) => ({
      ...n,
      id: `${n.type ?? 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: { x: n.position.x + 40, y: n.position.y + 40 },
      selected: false,
    }));
    setNodes((prev) => {
      const next = [...prev, ...newNodes];
      pushHistory(next, edgesRef.current);
      return next;
    });
  }

  function deleteSelected() {
    const selectedIds = new Set(
      nodes.filter((n) => n.selected && !n.data?.deleteLocked).map((n) => n.id),
    );
    if (selectedIds.size === 0) return;
    setNodes((prev) => {
      let updated = prev;
      for (const n of prev) {
        if (n.type === 'frame' && selectedIds.has(n.id)) {
          const frame = n;
          updated = updated.map((child) => {
            if (child.parentId !== frame.id) return child;
            return {
              ...child,
              parentId: undefined,
              extent: undefined,
              position: { x: child.position.x + frame.position.x, y: child.position.y + frame.position.y },
            };
          });
        }
      }
      const next = updated.filter((n) => !selectedIds.has(n.id));
      const nextEdges = edgesRef.current.filter(
        (e) => !selectedIds.has(e.source) && !selectedIds.has(e.target),
      );
      setEdges(nextEdges);
      pushHistory(next, nextEdges);
      return next;
    });
    setSelectedNode(null);
  }

  function groupSelectedNodes() {
    const selected = nodes.filter((n) => n.selected && !n.parentId && n.type !== 'frame');
    if (selected.length < 1) return;

    const PADDING = 40;
    const minX = Math.min(...selected.map((n) => n.position.x)) - PADDING;
    const minY = Math.min(...selected.map((n) => n.position.y)) - PADDING - 20;
    const maxX = Math.max(...selected.map((n) => n.position.x + ((n.measured?.width as number) ?? 200))) + PADDING;
    const maxY = Math.max(...selected.map((n) => n.position.y + ((n.measured?.height as number) ?? 80))) + PADDING;

    const frameW = maxX - minX;
    const frameH = maxY - minY;
    const frameId = `frame-${Date.now()}`;

    const frameNode: Node = {
      id: frameId,
      type: 'frame',
      position: { x: minX, y: minY },
      style: { width: frameW, height: frameH },
      zIndex: -1,
      selectable: true,
      connectable: false,
      data: { frameName: 'Group', frameColor: '#6366f1', collapsed: false, expandedHeight: frameH },
    };

    const selectedIds = new Set(selected.map((n) => n.id));
    setNodes((prev) => {
      const updated = prev.map((n) => {
        if (!selectedIds.has(n.id)) return { ...n, selected: false };
        return {
          ...n,
          parentId: frameId,
          extent: 'parent' as const,
          position: { x: n.position.x - minX, y: n.position.y - minY },
          selected: false,
        };
      });
      const next = [frameNode, ...updated];
      pushHistory(next, edgesRef.current);
      return next;
    });
  }

  function ungroupFrame(frameId: string) {
    setNodes((prev) => {
      const frame = prev.find((n) => n.id === frameId);
      if (!frame) return prev;
      const next = prev
        .map((n) => {
          if (n.parentId !== frameId) return n;
          return {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: { x: n.position.x + frame.position.x, y: n.position.y + frame.position.y },
          };
        })
        .filter((n) => n.id !== frameId);
      pushHistory(next, edgesRef.current);
      return next;
    });
    setContextMenu(null);
  }

  /* ── Test single node ─────────────────────────────────────────── */
  async function runTestNode() {
    if (!testNodeDialog) return;
    setTestNodeRunning(true);
    try {
      let parsedInput: unknown;
      try { parsedInput = JSON.parse(testNodeInput); } catch { parsedInput = { input: testNodeInput }; }

      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const result = await api.post<{ output: unknown; error?: string; durationMs?: number }>(
        `/workspaces/${workspaceId}/pods/${podId}/nodes/test`,
        { nodeType: testNodeDialog.node.type, nodeData: testNodeDialog.node.data, input: parsedInput },
      );
      setNodeResults((prev) => ({
        ...prev,
        [testNodeDialog.node.id]: { status: 'completed', output: result.output, durationMs: result.durationMs },
      }));
      setNodes((nds) => nds.map((n) =>
        n.id === testNodeDialog.node.id ? { ...n, data: { ...n.data, status: 'completed' } } : n,
      ));
      showToast('Node test completed');
    } catch (err) {
      setNodeResults((prev) => ({
        ...prev,
        [testNodeDialog!.node.id]: { status: 'failed', error: err instanceof Error ? err.message : 'Test failed' },
      }));
      showToast(err instanceof Error ? err.message : 'Node test failed', 'error');
    } finally {
      setTestNodeRunning(false);
      setTestNodeDialog(null);
    }
  }

  async function handleSave(opts?: { silent?: boolean }) {
    setIsSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      localStorage.setItem(`linea:autosave:${workflowId}`, String(autoSave));
      await api.patch(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`, {
        name: workflowName,
        ...(opts?.silent ? { skipVersion: true } : {}),
        definition: {
          nodes: nodes.map((n) => ({
            id: n.id, type: n.type, position: n.position, data: n.data,
            ...(n.style ? { style: n.style as Record<string, unknown> } : {}),
            ...(n.parentId ? { parentId: n.parentId } : {}),
            ...(n.extent ? { extent: String(n.extent) } : {}),
            ...(n.zIndex !== undefined ? { zIndex: n.zIndex } : {}),
          })),
          edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? undefined, targetHandle: e.targetHandle ?? undefined, label: e.label ?? undefined })),
          settings: { testCases },
        },
      });
      showToast('Workflow saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setIsSaving(false);
    }
  }
  handleSaveRef.current = handleSave;

  async function handleDeploy() {
    try {
      await handleSave();
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      const result = await api.post<{ deployedAt?: string }>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/deploy`, {});
      setIsDeployed(true);
      setDeployedAt(result.deployedAt ?? new Date().toISOString());
      showToast('Workflow deployed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Deploy failed', 'error');
    }
  }

  async function handleUndeploy() {
    try {
      const token = await getToken();
      if (!token) return;
      const api = createApiClient(token);
      await api.post(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}/undeploy`, {});
      setIsDeployed(false);
      setDeployedAt(null);
      showToast('Workflow unpublished');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Undeploy failed', 'error');
    }
  }

  /* ---- SSE handler -------------------------------------------- */
  function truncatePreview(v: unknown, max = 72): string {
    const s = typeof v === 'string' ? v : JSON.stringify(v) ?? '';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function handleSSEEvent(evt: SSEEvent, executionId: string) {
    switch (evt.type) {
      case 'node_update':
        if (evt.nodeId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === evt.nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      status: evt.status,
                      ...(evt.status === 'completed' && evt.output !== undefined
                        ? { _outputPreview: truncatePreview(evt.output) }
                        : {}),
                    },
                  }
                : n,
            ),
          );
          setNodeResults((prev) => ({
            ...prev,
            [evt.nodeId!]: {
              ...prev[evt.nodeId!],
              status: evt.status ?? 'unknown',
              output: evt.output,
              error: evt.error,
              durationMs: evt.durationMs,
              ...(evt.status === 'running' && !prev[evt.nodeId!]?.startedAt
                ? { startedAt: Date.now() }
                : {}),
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

  function handleRetryNode(nodeId: string) {
    setNodeResults((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId]!, status: 'running', startedAt: Date.now(), error: undefined },
    }));
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, status: 'running' } } : n,
    ));
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
        isDeployed={isDeployed}
        runStatus={runStatus}
        validationState={validationState}
        deployPanelOpen={deployPanelOpen}
        historyOpen={historyOpen}
        versionsOpen={versionsOpen}
        shareOpen={shareOpen}
        commentsOpen={commentsOpen}
        evalsOpen={evalsOpen}
        canUndo={canUndo}
        canRedo={canRedo}
        autoSave={autoSave}
        token={authToken}
        workspaceId={workspaceId}
        podId={podId}
        workflowId={workflowId}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        onAutoSaveToggle={handleAutoSaveToggle}
        onSave={() => void handleSave()}
        onRun={() => setConfirm({
          title: 'Run workflow',
          description: 'This will execute the current workflow using the test inputs defined in the Start node. Any configured actions (API calls, messages, etc.) will run for real.',
          action: 'Run',
          onConfirm: () => void handleRun(),
        })}
        onDeployPanel={() => void openDeployPanel()}
        onBack={() => router.push(`/pods/${podId}/workflows`)}
        onNameChange={setWorkflowName}
        onGenerate={() => void openGenerate()}
        onHistory={() => void openHistory()}
        onVersions={() => void openVersions()}
        onShare={() => void openShare()}
        onComments={() => void openComments()}
        onEvals={() => void openEvals()}
        onExport={handleExport}
        onImport={handleImport}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
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

        {/* Center column: canvas + bottom panel */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="relative flex-1 min-h-0"
          onDragOver={isGenerating ? undefined : onDragOver}
          onDrop={isGenerating ? undefined : onDrop}
        >
          {/* Canvas node search (Ctrl+F) */}
          {searchOpen && (
            <>
              <div className="absolute inset-0 z-[90]" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} />
              <div className="absolute top-3 left-1/2 z-[91] -translate-x-1/2 w-80 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                  <HugeiconsIcon icon={Search01Icon} className="size-3.5 text-muted-foreground shrink-0" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }}
                    placeholder="Search nodes by name or type…"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                  <kbd className="shrink-0 text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5">Esc</kbd>
                </div>
                {(() => {
                  const q = searchQuery.trim().toLowerCase();
                  if (!q) return null;
                  const hits = nodes
                    .filter((n) => n.type !== 'frame' && n.type !== 'note')
                    .filter((n) => {
                      const name = ((n.data?.nodeName as string) ?? (n.data?.label as string) ?? n.type ?? '').toLowerCase();
                      return name.includes(q) || (n.type ?? '').toLowerCase().includes(q);
                    })
                    .slice(0, 8);
                  if (hits.length === 0) {
                    return <div className="py-6 text-center text-xs text-muted-foreground">No nodes found</div>;
                  }
                  return (
                    <div className="max-h-60 overflow-auto py-1">
                      {hits.map((n) => {
                        const name = ((n.data?.nodeName as string) ?? (n.data?.label as string) ?? n.type ?? n.id);
                        const color = NODE_COLORS[(n.data?.nodeType as string) ?? n.type ?? ''] ?? '#6366f1';
                        return (
                          <button
                            key={n.id}
                            onClick={() => {
                              rfInstance?.fitView({ nodes: [{ id: n.id }], duration: 400, padding: 0.6, maxZoom: 1.5 });
                              setSearchOpen(false);
                              setSearchQuery('');
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                          >
                            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{n.type}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </>
          )}

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
            onNodeContextMenu={isGenerating ? undefined : onNodeContextMenu}
            onEdgeDoubleClick={isGenerating ? undefined : onEdgeDoubleClick}
            onInit={setRfInstance}
            nodeTypes={nodeTypes}
            nodesDraggable={!isGenerating && isInteractive}
            nodesConnectable={!isGenerating && isInteractive}
            elementsSelectable={!isGenerating && isInteractive}
            panOnDrag={!isGenerating && cursorMode === 'grab'}
            selectionOnDrag={!isGenerating && cursorMode === 'select'}
            fitView
            fitViewOptions={{ padding: 0.4, maxZoom: 0.85 }}
            minZoom={0.1}
            maxZoom={2}
            deleteKeyCode={isGenerating ? null : ['Delete', 'Backspace']}
            proOptions={{ hideAttribution: true }}
            className={isGenerating ? 'pointer-events-none' : ''}
          >
            <CanvasControls
              cursorMode={cursorMode}
              setCursorMode={setCursorMode}
              isInteractive={isInteractive}
              onInteractiveToggle={() => setIsInteractive((v) => !v)}
            />

            {/* Minimap with chevron toggle */}
            <Panel position="bottom-right" className="!m-0 !p-0">
              <div className="flex flex-col items-end">
                <button
                  onClick={() => setMinimapVisible((v) => !v)}
                  title={minimapVisible ? 'Collapse minimap' : 'Expand minimap'}
                  className="mr-2.5 flex size-5 items-center justify-center rounded-t-md border border-b-0 border-border bg-background/90 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HugeiconsIcon
                    icon={minimapVisible ? ArrowDown01Icon : ArrowUp01Icon}
                    className="size-2.5"
                  />
                </button>
                {minimapVisible && (
                  <MiniMap
                    nodeColor={(n) => NODE_COLORS[(n.data?.nodeType as string) ?? n.type ?? ''] ?? '#d4d4d8'}
                    className="!relative !bottom-auto !right-auto !m-0 rounded-b-lg rounded-tl-lg border border-border"
                  />
                )}
              </div>
            </Panel>
          </ReactFlow>

          {/* Multi-select toolbar */}
          {(() => {
            const sel = nodes.filter((n) => n.selected);
            if (sel.length < 2) return null;
            return (
              <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1 rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-1.5 shadow-md">
                <span className="text-xs font-medium text-muted-foreground pr-2 border-r border-border mr-1">
                  {sel.length} selected
                </span>
                <button
                  onClick={duplicateSelected}
                  title="Duplicate selected"
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
                  Duplicate
                </button>
                <button
                  onClick={groupSelectedNodes}
                  title="Group into frame"
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  <HugeiconsIcon icon={BorderAll01Icon} className="size-3.5" />
                  Group
                </button>
                <button
                  onClick={deleteSelected}
                  title="Delete selected"
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                  Delete
                </button>
              </div>
            );
          })()}

          {/* Edge label editor */}
          {editingEdge && (
            <>
              <div className="fixed inset-0 z-[198]" onClick={commitEdgeLabel} />
              <div
                className="fixed z-[199]"
                style={{ left: editingEdge.x - 64, top: editingEdge.y - 16 }}
              >
                <input
                  autoFocus
                  value={editingEdge.label}
                  onChange={(e) => setEditingEdge((prev) => prev ? { ...prev, label: e.target.value } : null)}
                  onBlur={commitEdgeLabel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdgeLabel();
                    if (e.key === 'Escape') setEditingEdge(null);
                  }}
                  placeholder="Edge label…"
                  className="w-36 rounded-lg border-2 border-primary bg-background px-3 py-1.5 text-xs font-medium shadow-xl outline-none text-center text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </>
          )}

          {/* Context menu */}
          {contextMenu && (
            <>
              <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} />
              <div
                className="fixed z-[100] min-w-44 overflow-hidden rounded-lg border border-border bg-background shadow-lg py-1"
                style={{ left: contextMenu.x, top: contextMenu.y }}
              >
                {(() => {
                  const isFrame = contextMenu.node.type === 'frame';
                  const isCanvas = contextMenu.node.type === 'note' || isFrame;
                  const isTerminal = contextMenu.node.type === 'start' || contextMenu.node.type === 'end';
                  type MenuItem = { icon: typeof PlayIcon; label: string; onClick: () => void };
                  const items: MenuItem[] = [];
                  if (!isCanvas && !isTerminal) items.push({ icon: PlayIcon, label: 'Test node', onClick: () => { setTestNodeInput('{}'); setTestNodeDialog({ node: contextMenu.node }); setContextMenu(null); } });
                  items.push({ icon: Copy01Icon, label: 'Duplicate', onClick: () => duplicateNode(contextMenu.node) });
                  if (isFrame) items.push({ icon: BorderAll01Icon, label: 'Ungroup', onClick: () => ungroupFrame(contextMenu.node.id) });
                  if (!isFrame) items.push({ icon: LockKeyIcon, label: contextMenu.node.data?.positionLocked ? 'Unlock position' : 'Lock position', onClick: () => toggleNodePositionLock(contextMenu.node) });
                  if (!isFrame) items.push({ icon: SquareLock01Icon, label: contextMenu.node.data?.deleteLocked ? 'Allow deletion' : 'Lock from deletion', onClick: () => toggleNodeDeletionLock(contextMenu.node) });
                  return items.map(({ icon, label, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <HugeiconsIcon icon={icon} className="size-3.5 text-muted-foreground shrink-0" />
                      {label}
                    </button>
                  ));
                })()}
                <div className="h-px bg-border my-1 mx-1" />
                <button
                  onClick={() => { handleNodeDelete(contextMenu.node.id); setContextMenu(null); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <HugeiconsIcon icon={Delete01Icon} className="size-3.5 shrink-0" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Bottom panel — centered under canvas only */}
        <BottomPanel
          nodes={nodes}
          nodeResults={nodeResults}
          validationState={validationState}
          runStatus={runStatus}
          workspaceId={workspaceId}
          podId={podId}
          token={authToken}
          onRetryNode={handleRetryNode}
        />
        </div>{/* end center column */}

        {/* Node config panel (right side) */}
        <div
          className="shrink-0 border-l border-border overflow-hidden transition-all duration-200"
          style={{ width: selectedNode && !generateOpen && !deployPanelOpen && !historyOpen && !versionsOpen && !shareOpen && !evalsOpen ? 340 : 0 }}
        >
          {selectedNode && !generateOpen && !deployPanelOpen && !historyOpen && !versionsOpen && !shareOpen && !evalsOpen && (
            <NodePanel
              node={selectedNode}
              nodes={nodes}
              edges={edges}
              onClose={() => setSelectedNode(null)}
              onUpdate={handleNodeUpdate}
              onDelete={handleNodeDelete}
              nodeResult={nodeResults[selectedNode.id]}
              token={authToken}
              workspaceId={workspaceId}
              podId={podId}
              executionId={runStatus?.id}
              onRetry={() => handleRetryNode(selectedNode.id)}
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
              nodes={nodes}
              edges={edges}
              onEvent={handleGenerateEvent}
              onClose={() => { setGenerateOpen(false); setIsGenerating(false); }}
            />
          )}
        </div>

        {/* Deploy panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: deployPanelOpen ? 360 : 0 }}
        >
          {deployPanelOpen && authToken && (
            <DeployPanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              isDeployed={isDeployed}
              deployedAt={deployedAt}
              onDeploy={handleDeploy}
              onUndeploy={handleUndeploy}
              onClose={() => setDeployPanelOpen(false)}
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

        {/* Versions panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: versionsOpen ? 280 : 0 }}
        >
          {versionsOpen && (
            <VersionsPanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              onRestore={handleVersionRestore}
              onDiff={(v) => setDiffVersion(v)}
              onClose={() => setVersionsOpen(false)}
            />
          )}
        </div>

        {/* Share panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: shareOpen ? 300 : 0 }}
        >
          {shareOpen && (
            <SharePanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              onClose={() => setShareOpen(false)}
            />
          )}
        </div>

        {/* Comments panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: commentsOpen ? 320 : 0 }}
        >
          {commentsOpen && (
            <CommentsPanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              nodes={nodes}
              selectedNodeId={selectedNode?.id}
              currentUserId={userId ?? undefined}
              onClose={() => setCommentsOpen(false)}
            />
          )}
        </div>

        {/* Evals panel */}
        <div
          className="shrink-0 border-l border-border bg-background transition-all duration-200 overflow-hidden"
          style={{ width: evalsOpen ? 380 : 0 }}
        >
          {evalsOpen && authToken && (
            <EvalsPanel
              workspaceId={workspaceId}
              podId={podId}
              workflowId={workflowId}
              token={authToken}
              testCases={testCases}
              onTestCasesChange={setTestCases}
              onClose={() => setEvalsOpen(false)}
            />
          )}
        </div>
      </div>


      {/* Diff viewer */}
      {diffVersion !== null && (
        <DiffPanel
          workspaceId={workspaceId}
          podId={podId}
          workflowId={workflowId}
          token={authToken}
          currentNodes={nodes}
          currentEdges={edges}
          targetVersion={diffVersion}
          onClose={() => setDiffVersion(null)}
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

      {/* Test node dialog */}
      <Dialog open={!!testNodeDialog} onOpenChange={(o) => { if (!o) setTestNodeDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={PlayIcon} className="size-4 text-blue-500 shrink-0" />
              <DialogTitle>
                Test — {(testNodeDialog?.node.data?.nodeName as string) ?? testNodeDialog?.node.type}
              </DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-sm text-muted-foreground">
            Provide mock input JSON and run this node in isolation.
          </DialogDescription>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Mock input (JSON)</label>
            <textarea
              value={testNodeInput}
              onChange={(e) => setTestNodeInput(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder='{"key": "value"}'
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestNodeDialog(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={testNodeRunning}
              onClick={() => void runTestNode()}
              className="gap-1.5"
            >
              {testNodeRunning
                ? <span className="size-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <HugeiconsIcon icon={PlayIcon} className="size-3.5" />}
              Run node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert02Icon} className="size-4 text-amber-500 shrink-0" />
              <DialogTitle>{confirm?.title}</DialogTitle>
            </div>
          </DialogHeader>
          <DialogDescription className="text-sm text-muted-foreground">
            {confirm?.description}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button size="sm" onClick={() => { confirm?.onConfirm(); setConfirm(null); }}>
              {confirm?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
