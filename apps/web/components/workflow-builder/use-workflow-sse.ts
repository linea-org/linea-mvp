import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import { createApiClient, API_BASE } from '@/lib/api';
import { consumeSseStream } from '@/lib/sse';
import { toast } from '@linea/ui/components/sonner';
import type { SSEEvent, NodeResult } from './workflow-builder.types';

interface UseWorkflowSSEArgs {
  workspaceId: string;
  podId: string;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setNodeResults: Dispatch<SetStateAction<Record<string, NodeResult>>>;
  setStreamingTokens: Dispatch<SetStateAction<Record<string, string>>>;
  setInterrupt: Dispatch<SetStateAction<SSEEvent['interrupt'] | null>>;
  setRunStatus: Dispatch<SetStateAction<{ id: string; status: string } | null>>;
  setExecutionOutput: Dispatch<SetStateAction<unknown>>;
}

export function useWorkflowSSE({
  workspaceId,
  podId,
  setNodes,
  setNodeResults,
  setStreamingTokens,
  setInterrupt,
  setRunStatus,
  setExecutionOutput,
}: UseWorkflowSSEArgs) {
  const sseAbortRef = useRef<AbortController | null>(null);

  const truncatePreview = useCallback((v: unknown, max = 72): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v) ?? '';
    return s.length > max ? s.slice(0, max) + '…' : s;
  }, []);

  const handleSSEEvent = useCallback((evt: SSEEvent, executionId: string) => {
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
      case 'agent_token':
        if (evt.nodeId && evt.delta) {
          setStreamingTokens((prev) => ({
            ...prev,
            [evt.nodeId!]: (prev[evt.nodeId!] ?? '') + evt.delta!,
          }));
        }
        break;
      case 'execution_complete':
        setStreamingTokens({});
        setRunStatus({ id: executionId, status: 'completed' });
        setInterrupt(null);
        if (evt.output !== undefined) setExecutionOutput(evt.output);
        toast.success('Execution completed', { id: `exec-${executionId}` });
        break;
      case 'execution_failed':
        setStreamingTokens({});
        setRunStatus({ id: executionId, status: 'failed' });
        setInterrupt(null);
        toast.error(evt.error ? `Execution failed: ${evt.error}` : 'Execution failed', { id: `exec-${executionId}` });
        break;
      case 'execution_status':
        if (evt.status) {
          setRunStatus({ id: executionId, status: evt.status });
        }
        break;
      default:
        break;
    }
  }, [setNodes, setNodeResults, setStreamingTokens, setInterrupt, setRunStatus, setExecutionOutput, truncatePreview]);

  const pollExecutionFinalStatus = useCallback(async (token: string, executionId: string) => {
    try {
      const api = createApiClient(token);
      const ex = await api.get<{ status: string; output?: { result?: unknown } | null; error?: string | null }>(
        `/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}`,
      );
      if (ex.status === 'completed') {
        setRunStatus({ id: executionId, status: 'completed' });
        const rawOutput = ex.output?.result;
        if (rawOutput !== undefined) setExecutionOutput(rawOutput);
        toast.success('Execution completed', { id: `exec-${executionId}` });
      } else if (ex.status === 'failed') {
        setRunStatus({ id: executionId, status: 'failed' });
        toast.error(ex.error ? `Execution failed: ${ex.error}` : 'Execution failed', { id: `exec-${executionId}` });
      }
    } catch {
      // best-effort — toast already shown if SSE delivered the event
    }
  }, [workspaceId, podId, setRunStatus, setExecutionOutput]);

  const startSSE = useCallback(async (token: string, executionId: string) => {
    sseAbortRef.current?.abort();
    const ac = new AbortController();
    sseAbortRef.current = ac;

    let receivedTerminal = false;
    let lastEventId: string | null = null;

    for (let attempt = 0; attempt <= 5; attempt++) {
      if (ac.signal.aborted) return;

      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (lastEventId) headers['Last-Event-ID'] = lastEventId;

        const resp = await fetch(
          `${API_BASE}/workspaces/${workspaceId}/pods/${podId}/executions/${executionId}/events`,
          { headers, signal: ac.signal },
        );
        if (!resp.ok || !resp.body) return;

        const reader = resp.body.getReader();
        await consumeSseStream<SSEEvent>(reader, (evt, eventId) => {
          if (eventId) lastEventId = eventId;
          if (evt.type === 'execution_complete' || evt.type === 'execution_failed') {
            receivedTerminal = true;
          }
          handleSSEEvent(evt, executionId);
        });

        // Stream ended cleanly — if we missed the terminal event, poll for final status
        if (!receivedTerminal && !ac.signal.aborted) {
          await pollExecutionFinalStatus(token, executionId);
        }
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Network drop — reconnect with exponential backoff
        if (attempt < 5 && !ac.signal.aborted) {
          await new Promise<void>((resolve) => {
            const delay = Math.min(1_000 * 2 ** attempt, 30_000);
            const t = setTimeout(resolve, delay);
            ac.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); });
          });
        }
      }
    }
  }, [workspaceId, podId, handleSSEEvent, pollExecutionFinalStatus]);

  return { startSSE, sseAbortRef };
}
