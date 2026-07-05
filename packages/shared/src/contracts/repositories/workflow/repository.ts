import {
  NewWorkflow,
  Workflow,
  WorkflowListResult,
  WorkflowQ,
} from "./types.js"

export interface WorkflowRepository {
  findById(id: string): Promise<Workflow | null>
  findAll(
    podId: string,
    userId: string,
    query: WorkflowQ
  ): Promise<WorkflowListResult>
  create(workflow: NewWorkflow): Promise<Workflow | null>
  update(
    id: string,
    userId: string,
    workflow: Partial<NewWorkflow>
  ): Promise<Workflow | null>

  delete(id: string, userId: string): Promise<boolean>
}
