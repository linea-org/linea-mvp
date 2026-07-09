import { VariableMap } from "../../runtime/index.js"

export type Execution = {
  id: string
  createdAt: Date
  workspaceId: string
  podId: string | null
  workflowId: string | null
  error: string | null
  threadId: string | null
  queueJobId: string | null
  status:
    "queued" | "running" | "suspended" | "completed" | "failed" | "cancelled"
  input: VariableMap
  variables: VariableMap
  output: VariableMap | null
  nodeResults: Record<string, VariableMap>
  checkpoint: unknown
  tokenUsage: {
    input: number
    output: number
    total: number
  } | null
  triggeredBy: "manual" | "schedule" | "webhook" | "sdk"
  startedAt: Date | null
  finishedAt: Date | null
}

export type NewExecution = {
  workspaceId: string
  id?: string | undefined
  createdAt?: Date | undefined
  podId?: string | null | undefined
  workflowId?: string | null | undefined
  error?: string | null | undefined
  threadId?: string | null | undefined
  queueJobId?: string | null | undefined
  status?:
    | "queued"
    | "running"
    | "suspended"
    | "completed"
    | "failed"
    | "cancelled"
    | undefined
  input?: VariableMap | undefined
  variables?: VariableMap | undefined
  output?: VariableMap | null
  nodeResults?: any
  checkpoint?: unknown
  tokenUsage?:
    | {
        input: number
        output: number
        total: number
      }
    | null
    | undefined
  triggeredBy?: "manual" | "schedule" | "webhook" | "sdk" | undefined
  startedAt?: Date | undefined
  finishedAt?: Date | undefined
}
