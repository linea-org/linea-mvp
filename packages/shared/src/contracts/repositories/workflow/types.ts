import { WorkflowEdge, WorkflowNode } from "../../runtime/index.js"

export type WorkflowQ = {
  isTemplate?: boolean
  trashed?: boolean
  starred?: boolean
  favorited?: boolean
  search?: string
  page?: number
  limit?: number
}

export type WorkflowListResult = {
  workflows: Workflow[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

export type Workflow = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  description: string | null
  podId: string
  definition: DBWorkflowDefinition | null
  isTemplate: boolean
  isPublic: boolean
  version: number
  starred: boolean
  deployedAt: Date | null
  deletedAt: Date | null
  logLevel: "none" | "errors" | "info" | "debug"
  logRetentionDays: number | null
  apiEnabled: boolean
  apiVisibility: "api_key" | "public"
  apiKey: string | null
  clonedFromTemplateId: string | null
  createdBy: string | null
}

export type NewWorkflow = {
  name: string
  podId: string
  id?: string | undefined
  createdAt?: Date | undefined
  updatedAt?: Date | undefined
  description?: string | null | undefined
  definition?: DBWorkflowDefinition | null | undefined
  isTemplate?: boolean | undefined
  isPublic?: boolean | undefined
  version?: number | undefined
  starred?: boolean | undefined
  deployedAt?: Date | null | undefined
  deletedAt?: Date | null | undefined
  logLevel?: "none" | "errors" | "info" | "debug" | undefined
  logRetentionDays?: number | null | undefined
  apiEnabled: boolean | undefined
  apiVisibility: "api_key" | "public" | undefined
  apiKey: string | null | undefined
  clonedFromTemplateId: string | null | undefined
  createdBy: string | null | undefined
}

export interface WorkflowNodeMetadata {
  position: {
    x: number
    y: number
  }
  label?: string
  style?: Record<string, unknown>
  parentId?: string
  extent?: string
  zIndex?: number
}

export type WorkflowNodeDefinition = WorkflowNode & {
  metadata: WorkflowNodeMetadata
}

export interface DBWorkflowDefinition {
  startNode: string
  nodes: WorkflowNodeDefinition[]
  edges: WorkflowEdge[]
}
