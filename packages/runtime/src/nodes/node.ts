export type WorkflowNodeType = "agent" | "transform" | "http"

export interface NodeRequest<TConfig> {
  workspaceId: string
  threadId: string

  config: TConfig
}

import { NodeMap } from "./index"

export interface NodeExecutor<T extends WorkflowNodeType> {
  readonly type: T

  execute(request: NodeMap[T]["request"]): Promise<NodeMap[T]["result"]>
}
