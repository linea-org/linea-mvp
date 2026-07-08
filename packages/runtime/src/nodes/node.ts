import type {
  VariableMap,
  WorkflowNode,
  WorkflowNodeMap,
  WorkflowNodeType,
} from "@linea/shared/contracts"

import { TemplateEngine } from "../template/engine.js"
import { RuntimeState } from "../types.js"

export interface NodeResult {
  variables: VariableMap
  nodeResults?: Record<string, VariableMap>
}

export interface NodeContext<TConfig> {
  node: WorkflowNode
  state: RuntimeState
  config: TConfig
  template: TemplateEngine
}

export interface NodeExecutor<T extends WorkflowNodeType> {
  readonly type: T
  execute(context: NodeContext<WorkflowNodeMap[T]>): Promise<NodeResult>
}
