import { and, eq } from "drizzle-orm"

import { workspaceMembers, workspaces } from "../../schema/workspaces.js"
import { DrizzleDB } from "../../client.js"
import {
  NewWorkspace,
  Workspace,
  WorkspaceRepository,
  WorkspaceWithMemberResult,
} from "@linea/shared/contracts"

export class WorkspaceRepositoryImpl implements WorkspaceRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findByMemberId(
    id: string,
    memberId: string
  ): Promise<WorkspaceWithMemberResult | null> {
    const [record] = await this.db
      .select({
        workspace: workspaces,
        member: workspaceMembers,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaces.id, workspaceMembers.workspaceId)
      )
      .where(and(eq(workspaces.id, id), eq(workspaceMembers.userId, memberId)))
      .limit(1)
    if (!record) return null

    return record
  }

  async findById(id: string): Promise<Workspace | null> {
    const [record] = await this.db
      .select()
      .from(workspaces)

      .where(eq(workspaces.id, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async create(payload: NewWorkspace): Promise<Workspace | null> {
    const [record] = await this.db
      .insert(workspaces)
      .values(payload)
      .returning()

    if (!record) return null

    return record
  }

  async update(payload: NewWorkspace): Promise<Workspace | null> {
    const [record] = await this.db.update(workspaces).set(payload).returning()

    if (!record) return null

    return record
  }
  async delete(id: string): Promise<boolean> {
    // todo add validation of user
    const [row] = await this.db
      .delete(workspaces)
      .where(eq(workspaces.id, id))
      .returning()

    if (!row) return false

    return true
  }
}
