import { AgentNodeConfig } from "./nodes/agent/agent.types"
import { HttpNodeConfig } from "./nodes/http/http.types"
import { TransformNodeConfig } from "./nodes/transform/transform.types"

export interface WorkflowNodeMap {
  agent: AgentNodeConfig
  transform: TransformNodeConfig
  http: HttpNodeConfig
}

export type WorkflowNodeType = keyof WorkflowNodeMap

interface BaseWorkflowNode<T extends WorkflowNodeType = WorkflowNodeType> {
  id: string
  name: string

  type: T
  config: WorkflowNodeMap[T]
}

export type WorkflowNode = {
  [K in WorkflowNodeType]: BaseWorkflowNode<K>
}[WorkflowNodeType]

export interface WorkflowEdge {
  id: string

  source: string
  target: string

  sourceHandle?: string
  targetHandle?: string
}

export interface WorkflowDefinition {
  startNode: string

  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
