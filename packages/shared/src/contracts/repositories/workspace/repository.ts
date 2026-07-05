import { NewWorkspace, Workspace, WorkspaceWithMemberResult } from "./types.js"

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>
  findByMemberId(
    id: string,
    memberId: string
  ): Promise<WorkspaceWithMemberResult | null>
  create(payload: NewWorkspace): Promise<Workspace | null>
  update(payload: NewWorkspace): Promise<Workspace | null>
  delete(id: string): Promise<Boolean>
}
