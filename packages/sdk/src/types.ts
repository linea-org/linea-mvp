export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'suspended';

export interface Execution {
  id: string;
  workflowId: string | null;
  podId: string;
  workspaceId: string;
  status: ExecutionStatus;
  triggeredBy: string;
  input: Record<string, unknown>;
  output: unknown | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface TriggerOptions {
  workspaceId: string;
  podId: string;
  workflowId: string;
  input?: Record<string, unknown>;
}

export interface WaitOptions {
  /** Polling interval in ms. Default: 2000. */
  pollInterval?: number;
  /** Total wait timeout in ms. Default: 300_000 (5 min). */
  timeout?: number;
}

export type SSEEventType =
  | 'node_update'
  | 'execution_suspended'
  | 'execution_complete'
  | 'execution_failed';

export interface NodeUpdateEvent {
  type: 'node_update';
  nodeId: string;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  output?: unknown;
  error?: string;
}

export interface ExecutionSuspendedEvent {
  type: 'execution_suspended';
  interrupt: unknown;
}

export interface ExecutionCompleteEvent {
  type: 'execution_complete';
  status: string;
  output: unknown;
}

export interface ExecutionFailedEvent {
  type: 'execution_failed';
  error: string;
}

export type SSEEvent =
  | NodeUpdateEvent
  | ExecutionSuspendedEvent
  | ExecutionCompleteEvent
  | ExecutionFailedEvent;

export interface LineaClientOptions {
  /** API key starting with lnk_ */
  apiKey: string;
  /** Base URL including /v1. Default: https://api.linea.io/v1 */
  baseUrl?: string;
}
