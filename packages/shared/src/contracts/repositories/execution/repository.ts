import { VariableMap } from "../../runtime/nodes.js"
import { Execution, NewExecution } from "./types.js"

export interface ExecutionRepository {
  findById(id: string): Promise<Execution | null>

  countRunning(workspaceId: string): Promise<number>

  create(execution: NewExecution): Promise<Execution | null>

  update(execution: NewExecution): Promise<Execution | null>

  start(id: string): Promise<Execution | null>

  complete(
    id: string,
    payload: {
      variables: VariableMap
      tokenUsage?: Execution["tokenUsage"]
      finishedAt: Date
    }
  ): Promise<Execution | null>

  fail(
    id: string,
    payload: {
      error: string
      finishedAt: Date
    }
  ): Promise<Execution | null>

  delete(id: string): Promise<boolean>
}
