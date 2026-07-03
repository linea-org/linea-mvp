import type { ID, Timestamp } from "./common.js"

export type ExecutionStatus =
  | "queued"
  | "running"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled"

export type ExecutionTrigger = "manual" | "schedule" | "webhook" | "sdk"

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface NodeResult {
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  output?: unknown
  error?: string
  startedAt?: Timestamp
  finishedAt?: Timestamp
  tokenUsage?: { input: number; output: number }
}

export interface Execution {
  id: ID
  workflowId: ID | null
  workspaceId: ID
  status: ExecutionStatus
  input: Record<string, unknown>
  output: unknown | null
  error: string | null
  nodeResults: Record<string, NodeResult>
  variables: Record<string, unknown>
  triggeredBy: ExecutionTrigger
  queueJobId: string | null
  startedAt: Timestamp | null
  finishedAt: Timestamp | null
  createdAt: Timestamp
}

export interface ExecutionLog {
  id: ID
  executionId: ID
  nodeId: string | null
  level: LogLevel
  message: string
  data: unknown | null
  timestamp: Timestamp
}

// ─── SSE Event Types (shared between API and SDK) ────────────────────────────

export type ExecutionEvent =
  | {
      type: "node.started"
      nodeId: string
      nodeType: string
      timestamp: Timestamp
    }
  | {
      type: "node.completed"
      nodeId: string
      output: unknown
      timestamp: Timestamp
    }
  | { type: "node.failed"; nodeId: string; error: string; timestamp: Timestamp }
  | { type: "execution.completed"; output: unknown; timestamp: Timestamp }
  | { type: "execution.failed"; error: string; timestamp: Timestamp }
  | {
      type: "approval.required"
      approvalId: string
      message: string
      timestamp: Timestamp
    }
  | { type: "heartbeat"; timestamp: Timestamp }
