'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  Add01Icon,
  Cancel01Icon,
  ArrowUp01Icon,
  Loading01Icon,
  Tick01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { toast } from '@linea/ui/components/sonner';
import { createApiClient, ApiError, friendlyApiError } from '@/lib/api';
import { cn } from '@linea/ui/lib/utils';
import ReactMarkdown from 'react-markdown';
import { JsonOrPre } from '@/components/ui/json-or-pre';

const API_BASE = `${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'}/v1`;
const PLACEHOLDER_NODE_ID = '__placeholder';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface NodeStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  output?: unknown;
  error?: string;
  durationMs?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'workflow' | 'system' | 'trace';
  content: string;
  typing?: boolean;
  suspended?: boolean;
  isApproval?: boolean;
  isToolApproval?: boolean;
  toolName?: string;
  toolSummary?: string;
  steps?: NodeStep[];
  simulated?: boolean;
}

type ExecStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed';

interface SuspendedState {
  question: string;
  choices?: string[];
  isApproval: boolean;
  isToolApproval?: boolean;
  toolName?: string;
  toolSummary?: string;
}

interface SSEEvent {
  type: string;
  nodeId?: string;
  status?: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
  delta?: string;
  interrupt?: {
    type?: string;
    question?: string;
    message?: string;
    prompt?: string;
    choices?: string[];
    /** tool_approval fields */
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    summary?: string;
    step?: number;
  };
}

export interface ChatPreviewPanelProps {
  workspaceId: string;
  podId: string;
  workflowId: string;
  token: string;
  onClose: () => void;
  /** Called when an execution is created — lets the builder connect its own SSE for canvas node badges */
  onExecutionStarted?: (execId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function extractReply(output: unknown): string {
  if (output === null || output === undefined) return '(no output)';
  if (typeof output === 'string') return output;
  const o = output as Record<string, unknown>;
  if (typeof o['message'] === 'string') return o['message'];
  if (typeof o['result'] === 'string') return o['result'];
  if (typeof o['response'] === 'string') return o['response'];
  if (typeof o['text'] === 'string') return o['text'];
  return JSON.stringify(output, null, 2);
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ------------------------------------------------------------------ */
/*  Agent output renderer                                               */
/* ------------------------------------------------------------------ */
interface ToolCallEntry {
  step: number;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

function AgentOutputView({ output }: { output: Record<string, unknown> }) {
  const toolLog = output['__toolCallLog'] as ToolCallEntry[] | undefined;
  const memoryUpdates = output['__memoryUpdates'] as Record<string, unknown> | undefined;
  const agentValue = output['__agentValue'] as string | undefined;
  const hasTools = toolLog && toolLog.length > 0;
  const hasMemory = memoryUpdates && Object.keys(memoryUpdates).length > 0;

  if (!hasTools && !hasMemory) {
    const text = agentValue ?? JSON.stringify(output, null, 2);
    return <pre className="whitespace-pre-wrap break-words">{text}</pre>;
  }

  return (
    <div className="space-y-2">
      {hasTools && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">
            Tool calls ({toolLog!.length})
          </p>
          <div className="space-y-1">
            {toolLog!.map((tc, i) => {
              const denied = typeof tc.result === 'object' && tc.result !== null && (tc.result as any).denied;
              return (
                <div key={i} className="rounded border border-border/40 bg-muted/30 px-2 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono font-semibold ${denied ? 'text-muted-foreground/50 line-through' : 'text-foreground/80'}`}>
                      {tc.name}
                    </span>
                    {denied && (
                      <span className="text-[9px] text-muted-foreground/60 border border-border/50 rounded px-1">denied</span>
                    )}
                  </div>
                  {tc.args && Object.keys(tc.args).length > 0 && (
                    <pre className="mt-0.5 text-[10px] text-muted-foreground/60 whitespace-pre-wrap">
                      {JSON.stringify(tc.args, null, 2).slice(0, 200)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {hasMemory && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">
            Memory
          </p>
          <div className="space-y-0.5">
            {Object.entries(memoryUpdates!).map(([k, v]) => (
              <div key={k} className="flex gap-1.5 font-mono text-[10px]">
                <span className="text-foreground/60 shrink-0">{k}</span>
                <span className="text-muted-foreground/60 truncate">{JSON.stringify(v).slice(0, 80)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {agentValue && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-1">Output</p>
          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap">{agentValue.slice(0, 300)}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StepRow                                                             */
/* ------------------------------------------------------------------ */
function StepRow({ step, streamingText }: { step: NodeStep; streamingText?: string }) {
  const [outputOpen, setOutputOpen] = useState(false);
  const hasContent = step.output !== undefined || !!step.error;

  // Detect agent output shape for badges
  const agentOutput = (
    step.output !== null &&
    typeof step.output === 'object' &&
    ('__toolCallLog' in (step.output as object) || '__memoryUpdates' in (step.output as object))
  ) ? step.output as Record<string, unknown> : null;

  const toolCount = agentOutput
    ? ((agentOutput['__toolCallLog'] as unknown[] | undefined)?.length ?? 0)
    : 0;
  const memoryCount = agentOutput
    ? Object.keys((agentOutput['__memoryUpdates'] as Record<string, unknown> | undefined) ?? {}).length
    : 0;

  return (
    <div className="border-b last:border-b-0 border-border/40">
      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
        {step.status === 'running' ? (
          <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin text-muted-foreground/70 shrink-0" />
        ) : step.status === 'completed' ? (
          <span className="size-1.5 rounded-full bg-foreground/25 shrink-0" />
        ) : step.status === 'suspended' ? (
          <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-pulse shrink-0" />
        ) : (
          <span className="size-1.5 rounded-full bg-destructive/70 shrink-0" />
        )}

        <span className="flex-1 font-medium text-foreground/80 truncate">{step.nodeName}</span>

        {toolCount > 0 && (
          <span className="text-[9px] text-muted-foreground/60 border border-border/50 rounded px-1 shrink-0">
            {toolCount}t
          </span>
        )}
        {memoryCount > 0 && (
          <span className="text-[9px] text-muted-foreground/60 border border-border/50 rounded px-1 shrink-0">
            mem
          </span>
        )}

        {step.nodeType && step.nodeType !== step.nodeName && (
          <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0">{step.nodeType}</span>
        )}

        {step.durationMs !== undefined && (
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtMs(step.durationMs)}</span>
        )}

        {hasContent && (
          <button
            onClick={() => setOutputOpen((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`size-2.5 transition-transform duration-150 ${outputOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Live streaming text for agent nodes */}
      {streamingText && step.status === 'running' && (
        <div className="px-3 pb-2 text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border-t border-border/40 bg-muted/20">
          {streamingText}
          <span className="inline-block size-1.5 bg-current rounded-full animate-pulse ml-0.5 align-middle" />
        </div>
      )}

      {/* Output — structured for agent nodes, JSON tree otherwise */}
      {outputOpen && step.output !== undefined && (
        <div className="px-3 pb-2 text-[11px] text-muted-foreground max-h-64 overflow-y-auto bg-muted/20 border-t border-border/40">
          {agentOutput ? (
            <AgentOutputView output={agentOutput} />
          ) : (
            <JsonOrPre value={step.output} className="text-[11px]" />
          )}
        </div>
      )}

      {/* Error */}
      {outputOpen && step.error && (
        <div className="px-3 pb-2 text-[11px] text-destructive border-t border-border/40">
          {step.error}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StepsTrace                                                          */
/* ------------------------------------------------------------------ */
function StepsTrace({
  steps,
  streamingText,
  streamingNodeId,
}: {
  steps: NodeStep[];
  streamingText: string;
  streamingNodeId: string | null;
}) {
  const isRunning = steps.some((s) => s.status === 'running');
  const [expanded, setExpanded] = useState(true);

  // Auto-collapse when execution finishes
  useEffect(() => {
    if (!isRunning && steps.length > 0) {
      const t = setTimeout(() => setExpanded(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isRunning, steps.length]);

  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const hasFailed = steps.some((s) => s.status === 'failed');

  return (
    <div className="flex gap-2 items-start">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
        <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Clickable header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-1.5 transition-colors"
        >
          {isRunning ? (
            <HugeiconsIcon icon={Loading01Icon} className="size-3 animate-spin text-muted-foreground/70" />
          ) : hasFailed ? (
            <span className="size-1.5 rounded-full bg-destructive/70" />
          ) : (
            <span className="size-1.5 rounded-full bg-foreground/25" />
          )}
          <span>{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
          {!isRunning && totalMs > 0 && (
            <span className="opacity-50">· {fmtMs(totalMs)}</span>
          )}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            className={`size-2.5 opacity-40 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Steps list */}
        {expanded && steps.length > 0 && (
          <div className="rounded-lg border border-border/60 overflow-hidden bg-background">
            {steps.map((step) => (
              <StepRow
                key={step.nodeId}
                step={step}
                streamingText={
                  step.nodeId === streamingNodeId && step.status === 'running'
                    ? streamingText
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ChatBubble                                                          */
/* ------------------------------------------------------------------ */
function ChatBubble({ msg, onApprove }: { msg: ChatMessage; onApprove?: (approved: boolean) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-1">
          {msg.simulated && (
            <div className="flex justify-end">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 border border-border/40 rounded px-1.5 py-0.5">
                Simulated
              </span>
            </div>
          )}
          <div className={`rounded-2xl rounded-tr-sm px-3 py-2 text-sm ${msg.simulated ? 'bg-muted text-foreground font-mono text-xs' : 'bg-primary text-primary-foreground'}`}>
            {msg.simulated ? msg.content.slice(0, 300) + (msg.content.length > 300 ? '…' : '') : msg.content}
          </div>
        </div>
      </div>
    );
  }
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1 text-center max-w-[90%]">
          {msg.content}
        </span>
      </div>
    );
  }
  // workflow bubble
  return (
    <div className="flex gap-2 items-start">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted mt-1">
        <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {msg.typing ? (
          <div className="flex items-center gap-1 py-2 px-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm',
              msg.suspended
                ? 'bg-muted border border-border text-foreground'
                : 'bg-muted text-foreground',
            )}
          >
            {msg.content ? (
              <ReactMarkdown
                components={{
                  p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  h1:     ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
                  h2:     ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                  h3:     ({ children }) => <p className="font-medium mb-1">{children}</p>,
                  ul:     ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                  ol:     ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                  li:     ({ children }) => <li className="text-sm">{children}</li>,
                  code:   ({ children, className: cls }) =>
                    cls
                      ? <code className="block bg-background/60 rounded p-2 text-xs font-mono my-1 overflow-x-auto whitespace-pre">{children}</code>
                      : <code className="bg-background/60 rounded px-1 text-xs font-mono">{children}</code>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  a:      ({ href, children }) => {
                    const safe = /^https?:\/\//i.test(href ?? '') ? href : '#';
                    return <a href={safe} className="underline text-primary" target="_blank" rel="noopener noreferrer">{children}</a>;
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              <span className="text-muted-foreground italic">(empty response)</span>
            )}
            {msg.isApproval && onApprove && (
              <div className="mt-3 space-y-2">
                {msg.isToolApproval && msg.toolName && (
                  <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">
                      Agent wants to run
                    </p>
                    <p className="font-mono text-xs text-foreground/80 mb-1">{msg.toolName}</p>
                    {msg.toolSummary && (
                      <pre className="text-[11px] text-muted-foreground/70 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        {msg.toolSummary}
                      </pre>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApprove(false)}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="mr-1 size-3.5" />
                    {msg.isToolApproval ? 'Deny' : 'Reject'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onApprove(true)}
                  >
                    <HugeiconsIcon icon={Tick01Icon} className="mr-1 size-3.5" />
                    {msg.isToolApproval ? 'Allow' : 'Approve'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel                                                               */
/* ------------------------------------------------------------------ */
export function ChatPreviewPanel({
  workspaceId, podId, workflowId, token, onClose, onExecutionStarted,
}: ChatPreviewPanelProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [execStatus, setExecStatus] = useState<ExecStatus>('idle');
  const [suspended, setSuspended] = useState<SuspendedState | null>(null);
  const [approvalMsgId, setApprovalMsgId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingNodeId, setStreamingNodeId] = useState<string | null>(null);

  const [startTriggerType, setStartTriggerType] = useState<'manual' | 'webhook' | 'schedule'>('manual');
  const [contextInputs, setContextInputs] = useState<Record<string, string>>({});
  const [contextOpen, setContextOpen] = useState(true);

  const sseAbortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Prevents duplicate terminal (complete/failed) messages when SSE + sync + REST fallback all fire */
  const terminalShownRef = useRef(false);
  /** nodeId → { name, type } map fetched from the workflow definition */
  const nodeMapRef = useRef<Record<string, { name: string; type: string }>>({});
  /** ID of the currently active trace message in the messages array */
  const traceIdRef = useRef<string | null>(null);
  /** nodeIds already added to the current trace (reset per turn) */
  const seenNodeIdsRef = useRef<Set<string>>(new Set());
  /** Latest auth token for use in stable callbacks */
  const execTokenRef = useRef<string>('');
  /** Sync function with fresh closures — updated every render */
  const syncCallbackRef = useRef<((execId: string) => Promise<void>) | null>(null);
  /** Always-current getToken fn from Clerk — updated every render */
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  /** Start node config (triggerType, inputVariables, testInput) loaded from workflow definition */
  const startConfigRef = useRef<{
    triggerType: 'manual' | 'webhook' | 'schedule';
    inputVariables: Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'object'; required: boolean }>;
    testInput: Record<string, string>;
  } | null>(null);
  /** Stable conversationId for the current chat session */
  const conversationIdRef = useRef<string>(crypto.randomUUID());
  /** Timer that upgrades the start placeholder to "Waiting in queue…" after 5 s */
  const queueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { sseAbortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  // Fetch workflow definition once so we have node names for the trace
  useEffect(() => {
    async function fetchDef() {
      try {
        const freshTok = await getTokenRef.current().catch(() => null) ?? token;
        const api = createApiClient(freshTok);
        const wf = await api.get<{
          definition: { nodes: { id: string; type: string; data?: Record<string, unknown> }[] };
        }>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`);
        const map: Record<string, { name: string; type: string }> = {};
        for (const n of wf.definition.nodes) {
          map[n.id] = {
            name: (n.data?.nodeName as string) ?? n.type ?? n.id,
            type: n.type ?? '',
          };
        }
        nodeMapRef.current = map;

        // Load Start node config for chat panel input adaptation
        const startNode = wf.definition.nodes.find((n) => n.type === 'start');
        if (startNode?.data) {
          const cfg = {
            triggerType: (startNode.data.triggerType as 'manual' | 'webhook' | 'schedule') ?? 'manual',
            inputVariables: (startNode.data.inputVariables as Array<{ name: string; type: 'string' | 'number' | 'boolean' | 'object'; required: boolean }>) ?? [],
            testInput: (startNode.data.testInput as Record<string, string>) ?? {},
          };
          startConfigRef.current = cfg;
          setStartTriggerType(cfg.triggerType);
          setContextInputs(cfg.testInput);
        }
      } catch { /* best-effort — trace falls back to nodeId */ }
    }
    void fetchDef();
  }, [workspaceId, podId, workflowId, token]);

  // Inline update — always has fresh closures for token, workspaceId, podId, handleSSEEvent
  syncCallbackRef.current = async (execId: string) => {
    const freshTok = await getTokenRef.current().catch(() => null) ?? execTokenRef.current;
    if (!freshTok) return;
    execTokenRef.current = freshTok;
    try {
      const api = createApiClient(freshTok);
      const ex = await api.get<{
        status: string;
        output?: unknown;
        error?: string | null;
        nodeResults?: Record<string, {
          status: string; output?: unknown; error?: string;
          startedAt?: string; finishedAt?: string; durationMs?: number;
        }>;
        variables?: Record<string, unknown>;
      }>(`/workspaces/${workspaceId}/pods/${podId}/executions/${execId}`);

      // Synthesize trace from node results, skipping already-shown nodes
      for (const [nodeId, result] of Object.entries(ex.nodeResults ?? {})) {
        if (result.status === 'pending' || result.status === 'skipped') continue;
        if (seenNodeIdsRef.current.has(nodeId)) continue;
        const dms = (result as any).durationMs ?? (
          result.startedAt && result.finishedAt
            ? new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime()
            : undefined
        );
        handleSSEEvent({ type: 'node_update', nodeId, status: 'running' }, execId);
        handleSSEEvent({ type: 'node_update', nodeId, status: result.status, output: result.output, error: result.error, durationMs: dms }, execId);
      }

      if (ex.status === 'suspended') {
        const pi = (ex.variables as any)?.__pendingInterrupt as {
          type?: string; nodeId?: string; message?: string; question?: string;
          toolName?: string; summary?: string; choices?: string[];
        } | undefined;
        if (pi) {
          handleSSEEvent({
            type: 'execution_suspended',
            interrupt: {
              type: pi.type, message: pi.message,
              question: pi.question ?? pi.message,
              toolName: pi.toolName, summary: pi.summary,
              choices: pi.choices,
            },
          }, execId);
        }
      } else if (ex.status === 'completed') {
        handleSSEEvent({ type: 'execution_complete', output: ex.output }, execId);
      } else if (ex.status === 'failed') {
        handleSSEEvent({ type: 'execution_failed', error: ex.error ?? undefined }, execId);
      }
    } catch { /* best-effort */ }
  };

  const handleSSEEvent = useCallback((evt: SSEEvent, _execId: string) => {
    switch (evt.type) {
      /* ---- Node lifecycle ----------------------------------------- */
      case 'node_update': {
        const { nodeId, status, output, error, durationMs } = evt;
        if (!nodeId || !status) break;

        const info = nodeMapRef.current[nodeId];
        const nodeName = info?.name ?? nodeId;
        const nodeType = info?.type ?? '';

        if (status === 'running') {
          if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
          // Lazily create the trace message (replaces the typing bubble / placeholder)
          const traceId = traceIdRef.current ?? `trace-${nodeId}-${Date.now()}`;
          traceIdRef.current = traceId;
          seenNodeIdsRef.current.add(nodeId);

          setMessages((prev) => {
            const traceMsg = prev.find((m) => m.id === traceId);
            if (traceMsg) {
              // Don't add duplicate steps (can happen when sync and SSE race)
              if (traceMsg.steps?.some((s) => s.nodeId === nodeId)) return prev;
              // Strip placeholder step before appending the real node
              const filteredSteps = (traceMsg.steps ?? []).filter((s) => s.nodeId !== PLACEHOLDER_NODE_ID);
              return prev.map((m) =>
                m.id === traceId
                  ? { ...m, steps: [...filteredSteps, { nodeId, nodeName, nodeType, status: 'running' as const }] }
                  : m,
              );
            }
            // First node — replace typing bubble with trace
            return [
              ...prev.filter((m) => !m.typing),
              {
                id: traceId,
                role: 'trace' as const,
                content: '',
                steps: [{ nodeId, nodeName, nodeType, status: 'running' as const }],
              },
            ];
          });

          setStreamingText('');
          setStreamingNodeId(nodeId);
        } else {
          // Update the existing step's final status
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== traceIdRef.current) return m;
              return {
                ...m,
                steps: (m.steps ?? []).map((s) =>
                  s.nodeId === nodeId
                    ? { ...s, status: status as NodeStep['status'], output, error, durationMs }
                    : s,
                ),
              };
            }),
          );
          // Clear streaming for this node
          setStreamingNodeId((prev) => (prev === nodeId ? null : prev));
          setStreamingText('');
        }
        break;
      }

      /* ---- Agent streaming token ---------------------------------- */
      case 'agent_token': {
        const { nodeId, delta } = evt;
        if (delta) {
          setStreamingText((prev) => prev + delta);
          if (nodeId) setStreamingNodeId(nodeId);
        }
        break;
      }

      /* ---- Suspension (ask_human / approval / tool_approval) ------- */
      case 'execution_suspended': {
        if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
        const interruptType = evt.interrupt?.type ?? 'ask_human';
        const isApproval = interruptType === 'approval';
        const isToolApproval = interruptType === 'tool_approval';
        const needsApproval = isApproval || isToolApproval;

        const q =
          evt.interrupt?.question ?? evt.interrupt?.message ?? evt.interrupt?.prompt ??
          (isToolApproval
            ? `Allow agent to run ${evt.interrupt?.toolName ?? 'a tool'}?`
            : isApproval
              ? 'Human review required.'
              : 'Please provide input.');

        // Mark any still-running step as suspended
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.steps) return m;
            return {
              ...m,
              steps: m.steps.map((s) =>
                s.status === 'running' ? { ...s, status: 'suspended' as const } : s,
              ),
            };
          }),
        );
        // Reset trace so that on resume a fresh trace is created
        traceIdRef.current = null;
        setStreamingText('');
        setStreamingNodeId(null);

        setSuspended({
          question: q,
          choices: evt.interrupt?.choices,
          isApproval: needsApproval,
          isToolApproval,
          toolName: evt.interrupt?.toolName,
          toolSummary: evt.interrupt?.summary,
        });

        const msgId = `w-${Date.now()}`;
        if (needsApproval) setApprovalMsgId(msgId);

        setMessages((prev) => [
          ...prev.filter((m) => !m.typing && !m.steps?.every((s) => s.nodeId === PLACEHOLDER_NODE_ID)),
          {
            id: msgId,
            role: 'workflow',
            content: q,
            suspended: true,
            isApproval: needsApproval,
            isToolApproval,
            toolName: evt.interrupt?.toolName,
            toolSummary: evt.interrupt?.summary,
          },
        ]);
        setExecStatus('suspended');
        break;
      }

      /* ---- Completion -------------------------------------------- */
      case 'execution_complete': {
        if (terminalShownRef.current) break;
        terminalShownRef.current = true;
        if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
        const reply = extractReply(evt.output);
        traceIdRef.current = null;
        setStreamingText('');
        setStreamingNodeId(null);
        setMessages((prev) => [
          ...prev.filter((m) => !m.typing && !m.steps?.every((s) => s.nodeId === PLACEHOLDER_NODE_ID)),
          { id: `w-${Date.now()}`, role: 'workflow', content: reply },
        ]);
        setSuspended(null);
        setApprovalMsgId(null);
        setExecStatus('completed');
        break;
      }

      /* ---- Failure ----------------------------------------------- */
      case 'execution_failed': {
        if (terminalShownRef.current) break;
        terminalShownRef.current = true;
        if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
        traceIdRef.current = null;
        setStreamingText('');
        setStreamingNodeId(null);
        setMessages((prev) => [
          ...prev.filter((m) => !m.typing && !m.steps?.every((s) => s.nodeId === PLACEHOLDER_NODE_ID)),
          {
            id: `sys-${Date.now()}`,
            role: 'system',
            content: `Execution failed: ${evt.error ?? 'Unknown error'}`,
          },
        ]);
        setSuspended(null);
        setApprovalMsgId(null);
        setExecStatus('failed');
        break;
      }

      /* ---- Execution status (emitted on SSE connect with current status) --- */
      case 'execution_status': {
        const st = (evt as any).status as string;
        // Trigger a REST sync when execution is already in a non-running terminal/suspended state
        if (st === 'suspended' || st === 'completed' || st === 'failed') {
          void syncCallbackRef.current?.(_execId);
        }
        break;
      }

      default:
        break;
    }
  }, []);

  const startSSE = useCallback(async (execToken: string, execId: string) => {
    execTokenRef.current = execToken;
    sseAbortRef.current?.abort();
    const ac = new AbortController();
    sseAbortRef.current = ac;

    let receivedTerminal = false;
    let lastEventId: string | null = null;
    let timedOut = false;
    const timeoutHandle = setTimeout(() => { timedOut = true; ac.abort(); }, 10 * 60 * 1000);

    outer: while (!ac.signal.aborted) {
      // Refresh Clerk token before each new SSE connection attempt
      const currentToken = await getTokenRef.current().catch(() => null) ?? execTokenRef.current;
      execTokenRef.current = currentToken;

      for (let attempt = 0; attempt <= 5; attempt++) {
        if (ac.signal.aborted) break outer;
        try {
          const headers: Record<string, string> = { Authorization: `Bearer ${currentToken}` };
          if (lastEventId) headers['Last-Event-ID'] = lastEventId;

          const resp = await fetch(
            `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/executions/${execId}/events`,
            { headers, signal: ac.signal },
          );
          // Non-2xx or no body — fall through to the REST fallback below
          if (!resp.ok || !resp.body) break;

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
              if (line.startsWith('id: ')) { lastEventId = line.slice(4).trim(); continue; }
              if (!line.startsWith('data: ')) continue;
              try {
                const raw = line.slice(6);
                let parsed = JSON.parse(raw) as any;
                // NestJS SSE serializes the full MessageEvent object (not just .data),
                // so the actual event payload is one level down at parsed.data
                if (parsed && typeof parsed === 'object' && !parsed.type && parsed.data && typeof parsed.data === 'object') {
                  parsed = parsed.data;
                }
                const evt = parsed as SSEEvent;
                if (evt.type === 'execution_complete' || evt.type === 'execution_failed') {
                  receivedTerminal = true;
                }
                handleSSEEvent(evt, execId);
              } catch { /* malformed line */ }
            }
          }

          // Stream closed cleanly — exit retry loop, go to fallback
          break;
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            clearTimeout(timeoutHandle);
            if (timedOut && !receivedTerminal) {
              setMessages((prev) => prev.filter((m) => !m.typing));
              setSuspended(null);
              setExecStatus('failed');
              toast.error('Lost track of this execution. Check the Executions page for the latest status.', { id: `sse-timeout-${execId}` });
            }
            return;
          }
          if (attempt < 5 && !ac.signal.aborted) {
            await new Promise<void>((resolve) => {
              const delay = Math.min(1_000 * 2 ** attempt, 30_000);
              const t = setTimeout(resolve, delay);
              ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
            });
          }
        }
      }

      // REST fallback: runs after every loop iteration that didn't receive a terminal event
      if (receivedTerminal || ac.signal.aborted) break;
      try {
        const api = createApiClient(currentToken);
        const ex = await api.get<{ status: string; output?: unknown; error?: string | null }>(
          `/workspaces/${workspaceId}/pods/${podId}/executions/${execId}`,
        );
        if (ex.status === 'completed') {
          receivedTerminal = true;
          handleSSEEvent({ type: 'execution_complete', output: ex.output }, execId);
          break;
        } else if (ex.status === 'failed') {
          receivedTerminal = true;
          handleSSEEvent({ type: 'execution_failed', error: ex.error ?? undefined }, execId);
          break;
        } else if (ex.status === 'running' || ex.status === 'queued') {
          // Execution still running — wait briefly then reconnect SSE
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 2000);
            ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
          });
          // Continue outer loop to retry SSE connection
        } else if (ex.status === 'suspended') {
          receivedTerminal = true;
          void syncCallbackRef.current?.(execId);
          break;
        } else {
          break;
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setMessages((prev) => prev.filter((m) => !m.typing));
          setSuspended(null);
          setApprovalMsgId(null);
          setStreamingText('');
          setStreamingNodeId(null);
          setExecStatus('failed');
          toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        } else {
          setMessages((prev) => [
            ...prev.filter((m) => !m.typing),
            {
              id: `sys-${Date.now()}`,
              role: 'system',
              content: 'Lost connection to this execution.',
            },
          ]);
          setSuspended(null);
          setApprovalMsgId(null);
          setStreamingText('');
          setStreamingNodeId(null);
          setExecStatus('failed');
          toast.error('Lost connection to this execution. Check the Executions page for the result.', { id: `conn-lost-${execId}` });
        }
        break;
      }
    }

    clearTimeout(timeoutHandle);
    if (timedOut && !receivedTerminal) {
      setMessages((prev) => prev.filter((m) => !m.typing));
      setSuspended(null);
      setExecStatus('failed');
      toast.error('Lost track of this execution. Check the Executions page for the latest status.', { id: `sse-timeout-${execId}` });
    }
  }, [workspaceId, podId, handleSSEEvent]);

  function resetRunState() {
    if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
    traceIdRef.current = null;
    seenNodeIdsRef.current = new Set();
    terminalShownRef.current = false;
    setStreamingText('');
    setStreamingNodeId(null);
    setSuspended(null);
    setApprovalMsgId(null);
  }

  async function send() {
    const isWebhook = startTriggerType === 'webhook';
    const text = inputText.trim();
    if (!isWebhook && (!text || isSending || execStatus === 'running')) return;
    if (isWebhook && (isSending || execStatus === 'running')) return;

    // Cast contextInputs to declared types
    const vars = startConfigRef.current?.inputVariables ?? [];

    const missingRequired = vars.filter((v) => v.required && !contextInputs[v.name]?.trim());
    if (missingRequired.length > 0) {
      toast.error(`Fill in required fields: ${missingRequired.map((v) => v.name).join(', ')}`);
      return;
    }
    const castContext: Record<string, unknown> = {};
    for (const v of vars) {
      const raw = contextInputs[v.name];
      if (raw === undefined || raw === '') continue;
      if (v.type === 'number') castContext[v.name] = Number(raw);
      else if (v.type === 'boolean') castContext[v.name] = raw === 'true';
      else if (v.type === 'object') { try { castContext[v.name] = JSON.parse(raw); } catch { castContext[v.name] = raw; } }
      else castContext[v.name] = raw;
    }

    const input: Record<string, unknown> = isWebhook
      ? { ...castContext }
      : { message: text, conversationId: conversationIdRef.current, ...castContext };

    const displayText = isWebhook ? '▶ Test run' : text;

    setInputText('');
    setIsSending(true);
    resetRunState();

    const typingId = `typing-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: displayText, simulated: isWebhook },
      { id: typingId, role: 'workflow', content: '', typing: true },
    ]);

    try {
      const freshTok = await getTokenRef.current().catch(() => null);
      if (!freshTok) {
        setMessages((prev) => prev.filter((m) => !m.typing));
        toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        return;
      }
      const api = createApiClient(freshTok);
      const ex = await api.post<{ id: string; status: string }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions`,
        { workflowId, input },
      );
      setExecutionId(ex.id);
      setExecStatus('running');
      onExecutionStarted?.(ex.id);
      const placeholderTraceId = `trace-${ex.id}-start`;
      traceIdRef.current = placeholderTraceId;
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        {
          id: placeholderTraceId,
          role: 'trace' as const,
          content: '',
          steps: [{ nodeId: PLACEHOLDER_NODE_ID, nodeName: '⏳ Starting execution…', nodeType: '', status: 'running' as const }],
        },
      ]);
      queueTimerRef.current = setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderTraceId && m.steps?.some((s) => s.nodeId === PLACEHOLDER_NODE_ID)
              ? { ...m, steps: m.steps.map((s) => s.nodeId === PLACEHOLDER_NODE_ID ? { ...s, nodeName: 'Waiting in queue…' } : s) }
              : m,
          ),
        );
      }, 5000);
      void startSSE(freshTok, ex.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessages((prev) => prev.filter((m) => !m.typing));
        toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { id: `sys-${Date.now()}`, role: 'system', content: friendlyApiError(err) },
      ]);
      setExecStatus('failed');
    } finally {
      setIsSending(false);
    }
  }

  async function answer(text: string) {
    if (!executionId || !text.trim()) return;
    const trimmed = text.trim();
    setInputText('');
    resetRunState();

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: trimmed },
      { id: `typing-${Date.now()}`, role: 'workflow', content: '', typing: true },
    ]);

    try {
      const freshTok = await getTokenRef.current().catch(() => null);
      if (!freshTok) {
        setMessages((prev) => prev.filter((m) => !m.typing));
        toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        return;
      }
      const api = createApiClient(freshTok);
      await api.patch(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/respond`,
        { answer: trimmed },
      );
      setExecStatus('running');
      void startSSE(freshTok, executionId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessages((prev) => prev.filter((m) => !m.typing));
        toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { id: `sys-${Date.now()}`, role: 'system', content: friendlyApiError(err) },
      ]);
    }
  }

  async function approveExecution(approved: boolean) {
    if (!executionId) return;
    resetRunState();

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: approved ? '✓ Approved' : '✗ Rejected' },
      { id: `typing-${Date.now()}`, role: 'workflow', content: '', typing: true },
    ]);

    try {
      const freshTok = await getTokenRef.current().catch(() => null);
      if (!freshTok) {
        setMessages((prev) => prev.filter((m) => !m.typing));
        toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        return;
      }
      const api = createApiClient(freshTok);
      await api.patch(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/respond`,
        { approved },
      );
      setExecStatus('running');
      void startSSE(freshTok, executionId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMessages((prev) => prev.filter((m) => !m.typing));
        toast.error('Session expired. Refresh the page to continue.', { id: 'session-expired' });
        return;
      }
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { id: `sys-${Date.now()}`, role: 'system', content: friendlyApiError(err) },
      ]);
    }
  }

  async function stopExecution() {
    sseAbortRef.current?.abort();
    resetRunState();
    setExecStatus('idle');

    if (executionId) {
      setMessages((prev) => [
        ...prev.filter((m) => !m.typing),
        { id: `sys-${Date.now()}`, role: 'system', content: 'Execution cancelled.' },
      ]);
      try {
        const freshTok = await getTokenRef.current().catch(() => null) ?? token;
        const api = createApiClient(freshTok);
        await api.delete(`/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}`);
      } catch { /* ignore */ }
    }
  }

  function startNewChat() {
    sseAbortRef.current?.abort();
    resetRunState();
    setMessages([]);
    setInputText('');
    setExecutionId(null);
    setExecStatus('idle');
    conversationIdRef.current = crypto.randomUUID();
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit() {
    if (suspended?.isApproval) return;
    if (suspended) void answer(inputText);
    else void send();
  }

  const isRunningOrSending = isSending || execStatus === 'running';
  const inputDisabled = isRunningOrSending || suspended?.isApproval === true;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Run Workflow</span>
          {execStatus === 'running' && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-pulse" />
              Running
            </span>
          )}
          {execStatus === 'suspended' && (
            <span className="text-[10px] text-muted-foreground">
              {suspended?.isApproval ? 'Awaiting approval' : 'Waiting for input'}
            </span>
          )}
          {execStatus === 'failed' && (
            <span className="text-[10px] text-destructive/80">Failed</span>
          )}
          {execStatus === 'completed' && (
            <span className="text-[10px] text-muted-foreground">Done</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="ghost" onClick={startNewChat} title="New run">
            <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose} title="Close">
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <HugeiconsIcon icon={WorkflowSquare01Icon} className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Run your workflow</p>
              {startTriggerType === 'webhook' ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Fill in the test payload fields below and click Run test.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    Type a message and press Enter to start.
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-2">
                    Your message is passed as{' '}
                    <code className="font-mono bg-muted px-1 rounded text-foreground/70">input.message</code>
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              if (msg.role === 'trace') {
                return (
                  <StepsTrace
                    key={msg.id}
                    steps={msg.steps ?? []}
                    streamingText={streamingText}
                    streamingNodeId={streamingNodeId}
                  />
                );
              }
              return (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  onApprove={msg.isApproval && msg.id === approvalMsgId ? approveExecution : undefined}
                />
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Inline context / test payload section */}
      {!suspended && (startConfigRef.current?.inputVariables ?? []).filter((v) => v.name).length > 0 && (
        <div className="shrink-0 border-t border-border/60">
          <button
            type="button"
            onClick={() => setContextOpen((o) => !o)}
            className="flex items-center gap-1.5 w-full px-4 py-1.5 text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/60 transition-colors"
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={cn('size-3 transition-transform duration-150', !contextOpen && '-rotate-90')}
            />
            {startTriggerType === 'webhook' ? 'Test payload' : 'Context'}
          </button>
          {contextOpen && (
            <div className="px-4 pb-2 space-y-1.5">
              {(startConfigRef.current?.inputVariables ?? []).filter((v) => v.name).map((v) => (
                <div key={v.name} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 w-20 truncate">{v.name}</span>
                  <input
                    type="text"
                    value={contextInputs[v.name] ?? ''}
                    onChange={(e) => setContextInputs((prev) => ({ ...prev, [v.name]: e.target.value }))}
                    placeholder={v.type === 'object' ? '{"key":"value"}' : `${v.type}…`}
                    disabled={isRunningOrSending}
                    className="flex-1 min-w-0 rounded border border-border/50 bg-transparent px-2 py-0.5 text-[11px] font-mono text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none focus:border-border disabled:opacity-50"
                  />
                  {v.required && !contextInputs[v.name] && (
                    <span className="text-[9px] text-destructive/60 shrink-0">req</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
        {suspended && !suspended.isApproval && (
          <p className="text-[11px] text-muted-foreground leading-snug">
            Waiting for:{' '}
            <span className="italic text-foreground/70">
              &quot;{suspended.question.length > 80 ? suspended.question.slice(0, 80) + '…' : suspended.question}&quot;
            </span>
          </p>
        )}
        {suspended?.isApproval ? (
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            {suspended.isToolApproval
              ? <>Use the <strong className="text-foreground/80">Allow</strong> or <strong className="text-foreground/80">Deny</strong> buttons above to continue.</>
              : <>Use the <strong className="text-foreground/80">Approve</strong> or <strong className="text-foreground/80">Reject</strong> buttons above to continue.</>}
          </div>
        ) : startTriggerType === 'webhook' ? (
          /* Webhook trigger — just a Run test button */
          <Button
            size="sm"
            className="w-full"
            onClick={() => void send()}
            disabled={isRunningOrSending}
          >
            {isRunningOrSending ? (
              <>
                <HugeiconsIcon icon={Loading01Icon} className="size-3.5 mr-2 animate-spin" />
                Running…
              </>
            ) : (
              'Run test'
            )}
          </Button>
        ) : (
          /* Manual / schedule trigger — chat input */
          <>
            {suspended?.choices && suspended.choices.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suspended.choices.map((c) => (
                  <button
                    key={c}
                    onClick={() => void answer(c)}
                    className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground/80 hover:bg-muted transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                  if (e.key === 'Escape' && isRunningOrSending) void stopExecution();
                }}
                disabled={inputDisabled}
                placeholder={
                  execStatus === 'running' ? 'Press Esc or click Stop to interrupt…'
                  : suspended ? 'Your answer…'
                  : 'Type a message and press Enter…'
                }
                rows={1}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed min-h-[36px] max-h-32"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                }}
              />
              {isRunningOrSending ? (
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => void stopExecution()}
                  title="Stop execution (Esc)"
                  className="shrink-0"
                >
                  <span className="size-3 rounded-sm bg-current block" />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  disabled={!inputText.trim()}
                  onClick={handleSubmit}
                  className="shrink-0"
                  title="Send (Enter)"
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
