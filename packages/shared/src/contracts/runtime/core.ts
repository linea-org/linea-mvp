import { WorkflowNodeMap } from "./nodes.js"

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
