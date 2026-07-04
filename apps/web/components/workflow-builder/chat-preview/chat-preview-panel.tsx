'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  WorkflowSquare01Icon,
  Add01Icon,
  Cancel01Icon,
  ArrowUp01Icon,
  Loading01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';
import { Button } from '@linea/ui/components/button';
import { toast } from '@linea/ui/components/sonner';
import { createApiClient, ApiError, friendlyApiError, API_BASE } from '@/lib/api';
import { consumeSseStream } from '@/lib/sse';
import { cn } from '@linea/ui/lib/utils';
import { StepsTrace } from './chat-preview-steps-trace';
import { ChatBubble } from './chat-preview-bubble';
import { extractReply, isErrorOutput } from './chat-preview-helpers';
import type {
  NodeStep,
  ChatMessage,
  ExecStatus,
  SuspendedState,
  SSEEvent,
  ChatPreviewPanelProps,
} from './chat-preview-panel.types';

export type { ChatPreviewPanelProps } from './chat-preview-panel.types';

const PLACEHOLDER_NODE_ID = '__placeholder';

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
  // Ref mirror of streamingText — updated synchronously in agent_token so the
  // node_update completion handler can capture the full text without a render race.
  const streamingTextRef = useRef('');

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
  /** Set to true on suspension so the next node_update inserts a "Resumed" divider */
  const resumedRef = useRef(false);
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

  const { data: chatWorkflowDef } = useQuery({
    queryKey: ['workflow-definition-trace', workspaceId, podId, workflowId],
    queryFn: async () => {
      const freshTok = await getTokenRef.current().catch(() => null) ?? token;
      const api = createApiClient(freshTok);
      return api.get<{
        definition: { nodes: { id: string; type: string; data?: Record<string, unknown> }[] };
      }>(`/workspaces/${workspaceId}/pods/${podId}/workflows/${workflowId}`);
    },
    retry: false,
  });

  useEffect(() => {
    if (!chatWorkflowDef) return;
    const map: Record<string, { name: string; type: string }> = {};
    for (const n of chatWorkflowDef.definition.nodes) {
      map[n.id] = {
        name: (n.data?.nodeName as string) ?? n.type ?? n.id,
        type: n.type ?? '',
      };
    }
    nodeMapRef.current = map;

    const startNode = chatWorkflowDef.definition.nodes.find((n) => n.type === 'start');
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
  }, [chatWorkflowDef]);

  function handleNodeUpdate(evt: SSEEvent) {
    const { nodeId, status, output, error, durationMs } = evt;
    if (!nodeId || !status) return;

    const info = nodeMapRef.current[nodeId];
    const nodeName = info?.name ?? nodeId;
    const nodeType = info?.type ?? '';

    if (status === 'running') {
      if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
      const traceId = traceIdRef.current ?? `trace-${nodeId}-${Date.now()}`;
      traceIdRef.current = traceId;
      seenNodeIdsRef.current.add(nodeId);

      const isResuming = resumedRef.current;
      if (isResuming) resumedRef.current = false;

      setMessages((prev) => {
        const traceMsg = prev.find((m) => m.id === traceId);
        if (traceMsg) {
          if (traceMsg.steps?.some((s) => s.nodeId === nodeId)) return prev;
          const filteredSteps = (traceMsg.steps ?? []).filter((s) => s.nodeId !== PLACEHOLDER_NODE_ID);
          const divider: NodeStep[] = isResuming
            ? [{ nodeId: `__divider__${Date.now()}`, nodeName: '', nodeType: '', status: 'divider' as const }]
            : [];
          return prev
            .filter((m) => !m.typing)
            .map((m) =>
              m.id === traceId
                ? { ...m, steps: [...filteredSteps, ...divider, { nodeId, nodeName, nodeType, status: 'running' as const }] }
                : m,
            );
        }
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
      return;
    }

    const capturedStreamedText = streamingTextRef.current || undefined;
    streamingTextRef.current = '';

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== traceIdRef.current) return m;
        return {
          ...m,
          steps: (m.steps ?? []).map((s) =>
            s.nodeId === nodeId
              ? { ...s, status: status as NodeStep['status'], output, error, durationMs, agentStreamedText: capturedStreamedText }
              : s,
          ),
        };
      }),
    );
    setStreamingNodeId((prev) => (prev === nodeId ? null : prev));
    setStreamingText('');
  }

  function handleAgentToken(evt: SSEEvent) {
    const { nodeId, delta } = evt;
    if (!delta) return;
    streamingTextRef.current += delta;
    setStreamingText((prev) => prev + delta);
    if (nodeId) setStreamingNodeId(nodeId);
  }

  function handleSuspension(evt: SSEEvent) {
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

    const suspendedStreamedText = streamingTextRef.current || undefined;
    streamingTextRef.current = '';

    setMessages((prev) =>
      prev.map((m) => {
        if (!m.steps) return m;
        return {
          ...m,
          steps: m.steps.map((s) =>
            s.status === 'running'
              ? { ...s, status: 'suspended' as const, agentStreamedText: suspendedStreamedText }
              : s,
          ),
        };
      }),
    );
    // Keep traceIdRef so post-resumption steps append to the same trace;
    // resumedRef signals the next node_update to prepend a "Resumed" divider.
    resumedRef.current = true;
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
  }

  function handleCompletion(evt: SSEEvent) {
    if (terminalShownRef.current) return;
    terminalShownRef.current = true;
    if (queueTimerRef.current) { clearTimeout(queueTimerRef.current); queueTimerRef.current = null; }
    const reply = isErrorOutput(evt.output) ? evt.output.error : extractReply(evt.output);
    const isError = isErrorOutput(evt.output);
    traceIdRef.current = null;
    setStreamingText('');
    setStreamingNodeId(null);
    setMessages((prev) => [
      ...prev.filter((m) => !m.typing && !m.steps?.every((s) => s.nodeId === PLACEHOLDER_NODE_ID)),
      { id: `w-${Date.now()}`, role: 'workflow', content: reply, ...(isError && { isError: true }) },
    ]);
    setSuspended(null);
    setApprovalMsgId(null);
    setExecStatus('completed');
  }

  function handleFailure(evt: SSEEvent) {
    if (terminalShownRef.current) return;
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
  }

  function handleExecutionStatus(evt: SSEEvent, execId: string) {
    if (evt.status === 'suspended' || evt.status === 'completed' || evt.status === 'failed') {
      void syncCallbackRef.current?.(execId);
    }
  }

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

      for (const [nodeId, result] of Object.entries(ex.nodeResults ?? {})) {
        if (result.status === 'pending' || result.status === 'skipped') continue;
        if (seenNodeIdsRef.current.has(nodeId)) continue;
        const dms = result.durationMs ?? (
          result.startedAt && result.finishedAt
            ? new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime()
            : undefined
        );
        handleSSEEvent({ type: 'node_update', nodeId, status: 'running' }, execId);
        handleSSEEvent({ type: 'node_update', nodeId, status: result.status, output: result.output, error: result.error, durationMs: dms }, execId);
      }

      if (ex.status === 'suspended') {
        const pi = ex.variables?.__pendingInterrupt as {
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

  const handleSSEEvent = useCallback((evt: SSEEvent, execId: string) => {
    switch (evt.type) {
      case 'node_update': handleNodeUpdate(evt); break;
      case 'agent_token': handleAgentToken(evt); break;
      case 'execution_suspended': handleSuspension(evt); break;
      case 'execution_complete': handleCompletion(evt); break;
      case 'execution_failed': handleFailure(evt); break;
      case 'execution_status': handleExecutionStatus(evt, execId); break;
      default: break;
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

    async function connectAndStream(currentToken: string): Promise<'closed' | 'aborted'> {
      for (let attempt = 0; attempt <= 5; attempt++) {
        if (ac.signal.aborted) return 'closed';
        try {
          const headers: Record<string, string> = { Authorization: `Bearer ${currentToken}` };
          if (lastEventId) headers['Last-Event-ID'] = lastEventId;

          const resp = await fetch(
            `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/executions/${execId}/events`,
            { headers, signal: ac.signal },
          );
          if (!resp.ok || !resp.body) return 'closed';

          const reader = resp.body.getReader();
          await consumeSseStream<SSEEvent>(reader, (evt, eventId) => {
            if (eventId) lastEventId = eventId;
            if (evt.type === 'execution_complete' || evt.type === 'execution_failed') {
              receivedTerminal = true;
            }
            handleSSEEvent(evt, execId);
          });
          return 'closed';
        } catch (err) {
          if ((err as Error).name === 'AbortError') {
            clearTimeout(timeoutHandle);
            if (timedOut && !receivedTerminal) {
              setMessages((prev) => prev.filter((m) => !m.typing));
              setSuspended(null);
              setExecStatus('failed');
              toast.error('Lost track of this execution. Check the Executions page for the latest status.', { id: `sse-timeout-${execId}` });
            }
            return 'aborted';
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
      return 'closed';
    }

    async function runRestFallback(currentToken: string): Promise<'break' | 'continue'> {
      try {
        const api = createApiClient(currentToken);
        const ex = await api.get<{ status: string; output?: unknown; error?: string | null }>(
          `/workspaces/${workspaceId}/pods/${podId}/executions/${execId}`,
        );
        if (ex.status === 'completed') {
          receivedTerminal = true;
          handleSSEEvent({ type: 'execution_complete', output: ex.output }, execId);
          return 'break';
        } else if (ex.status === 'failed') {
          receivedTerminal = true;
          handleSSEEvent({ type: 'execution_failed', error: ex.error ?? undefined }, execId);
          return 'break';
        } else if (ex.status === 'running' || ex.status === 'queued') {
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 2000);
            ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
          });
          return 'continue';
        } else if (ex.status === 'suspended') {
          receivedTerminal = true;
          void syncCallbackRef.current?.(execId);
          return 'break';
        }
        return 'break';
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
        return 'break';
      }
    }

    while (!ac.signal.aborted) {
      const currentToken = await getTokenRef.current().catch(() => null) ?? execTokenRef.current;
      execTokenRef.current = currentToken;

      const streamResult = await connectAndStream(currentToken);
      if (streamResult === 'aborted') return;

      if (receivedTerminal || ac.signal.aborted) break;
      const fallbackResult = await runRestFallback(currentToken);
      if (fallbackResult === 'break') break;
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
    resumedRef.current = false;
    streamingTextRef.current = '';
    seenNodeIdsRef.current = new Set();
    terminalShownRef.current = false;
    setStreamingText('');
    setStreamingNodeId(null);
    setSuspended(null);
    setApprovalMsgId(null);
  }

  // Partial reset for resumption after suspension — preserves traceIdRef and resumedRef
  // so the continuous-trace feature can append post-resumption steps to the same message.
  function resetMidRunState() {
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
    resetMidRunState();

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
    resetMidRunState();

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
      } catch (err) {
        toast.error(friendlyApiError(err));
      }
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
