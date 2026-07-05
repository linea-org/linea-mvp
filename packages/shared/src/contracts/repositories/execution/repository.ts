import { Execution, NewExecution } from "./types.js"

export interface ExecutionRepository {
  findById(id: string): Promise<Execution | null>
  create(execution: NewExecution): Promise<Execution | null>
  update(execution: NewExecution): Promise<Execution | null>
  delete(id: string): Promise<Boolean>
}
