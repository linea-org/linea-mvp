'use client';

import { useCallback, useRef, useState } from 'react';
import { useLineaContext } from '../context';
import type { Execution, TriggerOptions } from '@linea/sdk';

export type WorkflowStatus = 'idle' | 'running' | 'suspended' | 'completed' | 'failed';

export interface NodeEvent {
  nodeId: string;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  output?: unknown;
  error?: string;
  ts: number;
}

/** Shape of the interrupt payload sent by the engine on suspension */
export interface Interrupt {
  type?: 'ask_human' | 'approval' | 'tool_approval' | string;
  question?: string;
  message?: string;
  context?: string;
  toolName?: string;
  toolInput?: unknown;
  [key: string]: unknown;
}

export interface SuspensionState {
  executionId: string;
  workspaceId: string;
  podId: string;
  interrupt: Interrupt;
}

export interface RespondOptions {
  /** Human answer for ask_human interrupts */
  answer?: string;
  /** true = approved, false = denied — for approval / tool_approval interrupts */
  approved?: boolean;
  /** Optional comment or reason */
  comment?: string;
}

export interface WorkflowState {
  status: WorkflowStatus;
  execution: Execution | null;
  nodeEvents: NodeEvent[];
  suspended: SuspensionState | null;
  error: string | null;
}

export interface UseWorkflowReturn extends WorkflowState {
  /** Trigger the workflow and stream events in real time */
  run: (options: TriggerOptions) => Promise<void>;
  /** Respond to a suspended execution (ask_human / approval / tool_approval) */
  respond: (response: RespondOptions) => Promise<void>;
  /** Reset back to idle */
  reset: () => void;
}

type EngineEvent =
  | { type: 'node_update'; nodeId: string; status: NodeEvent['status']; output?: unknown; error?: string }
  | { type: 'execution_suspended'; interrupt: unknown }
  | { type: 'execution_complete'; status: string; output: unknown }
  | { type: 'execution_failed'; error: string };

export function useWorkflow(): UseWorkflowReturn {
  const { client, apiKey, baseUrl } = useLineaContext();
  const [state, setState] = useState<WorkflowState>({
    status: 'idle',
    execution: null,
    nodeEvents: [],
    suspended: null,
    error: null,
  });

  const execCtxRef = useRef<{ workspaceId: string; podId: string; executionId: string } | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const run = useCallback(
    async (options: TriggerOptions): Promise<void> => {
      stopStreamRef.current?.();
      stopStreamRef.current = null;

      setState({ status: 'running', execution: null, nodeEvents: [], suspended: null, error: null });

      try {
        const execution = await client.trigger(options);
        const { workspaceId, podId } = options;
        execCtxRef.current = { workspaceId, podId, executionId: execution.id };
        setState((s) => ({ ...s, execution }));

        const stop = client.streamEvents(
          workspaceId,
          podId,
          execution.id,
          (raw) => {
            const event = raw as EngineEvent;

            if (event.type === 'node_update') {
              setState((s) => {
                const next: NodeEvent = {
                  nodeId: event.nodeId,
                  status: event.status,
                  output: event.output,
                  error: event.error,
                  ts: Date.now(),
                };
                const idx = s.nodeEvents.findIndex((e) => e.nodeId === event.nodeId);
                const nodeEvents =
                  idx >= 0
                    ? s.nodeEvents.map((e, i) => (i === idx ? next : e))
                    : [...s.nodeEvents, next];
                return { ...s, nodeEvents };
              });
            } else if (event.type === 'execution_suspended') {
              // SSE stream stays open — execution will resume after respond()
              setState((s) => ({
                ...s,
                status: 'suspended',
                suspended: {
                  executionId: execution.id,
                  workspaceId,
                  podId,
                  interrupt: (event.interrupt ?? {}) as Interrupt,
                },
              }));
            } else if (event.type === 'execution_complete') {
              stopStreamRef.current?.();
              stopStreamRef.current = null;
              void client.getExecution(workspaceId, podId, execution.id).then((final) => {
                setState((s) => ({ ...s, status: 'completed', execution: final, suspended: null }));
              });
            } else if (event.type === 'execution_failed') {
              stopStreamRef.current?.();
              stopStreamRef.current = null;
              setState((s) => ({
                ...s,
                status: 'failed',
                suspended: null,
                error: event.error ?? 'Execution failed',
              }));
            }
          },
          (err) => {
            stopStreamRef.current = null;
            setState((s) => ({ ...s, status: 'failed', error: err.message }));
          },
        );

        stopStreamRef.current = stop;
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [client],
  );

  const respond = useCallback(
    async (response: RespondOptions): Promise<void> => {
      const ctx = execCtxRef.current;
      if (!ctx) return;

      setState((s) => ({ ...s, status: 'running', suspended: null }));

      try {
        await fetch(
          `${baseUrl}/workspaces/${ctx.workspaceId}/pods/${ctx.podId}/executions/${ctx.executionId}/respond`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(response),
          },
        );
        // The existing SSE stream will resume automatically
      } catch (err) {
        setState((s) => ({
          ...s,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Respond failed',
        }));
      }
    },
    [apiKey, baseUrl],
  );

  const reset = useCallback(() => {
    stopStreamRef.current?.();
    stopStreamRef.current = null;
    execCtxRef.current = null;
    setState({ status: 'idle', execution: null, nodeEvents: [], suspended: null, error: null });
  }, []);

  return { ...state, run, respond, reset };
}
