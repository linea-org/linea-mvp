import { RuntimeState } from "../graph/state"
import { TemplateEngine } from "../template/engine"
import { WorkflowNodeMap, WorkflowNodeType } from "../types"

export type VariableMap = Record<string, unknown>

export interface NodeResult {
  variables: VariableMap
}

export interface NodeContext<TConfig> {
  state: RuntimeState
  config: TConfig
  template: TemplateEngine
}

export interface NodeExecutor<T extends WorkflowNodeType> {
  readonly type: T
  execute(context: NodeContext<WorkflowNodeMap[T]>): Promise<NodeResult>
}
