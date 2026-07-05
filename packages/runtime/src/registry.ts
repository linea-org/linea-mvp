import { WorkflowNodeType } from "@linea/shared/contracts"
import { NodeExecutor } from "./nodes/node.js"

export class NodeRegistry {
  private readonly executors = new Map<
    WorkflowNodeType,
    NodeExecutor<WorkflowNodeType>
  >()

  constructor(executors: readonly NodeExecutor<WorkflowNodeType>[]) {
    for (const executor of executors) {
      if (this.executors.has(executor.type)) {
        throw new Error(`Node '${executor.type}' is already registered.`)
      }

      this.executors.set(executor.type, executor)
    }
  }

  get<T extends WorkflowNodeType>(type: T): NodeExecutor<T> {
    const executor = this.executors.get(type)

    if (!executor) {
      throw new Error(`Node '${type}' is not registered.`)
    }

    return executor as NodeExecutor<T>
  }
}
