import { workflowFavorites, workflows } from "../../schema/index.js"
import { DrizzleDB } from "../../client.js"
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
} from "drizzle-orm"
import {
  NewWorkflow,
  Workflow,
  WorkflowListResult,
  WorkflowQ,
  WorkflowRepository,
} from "@linea/shared/contracts"

export class WorkflowRepositoryImpl implements WorkflowRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findAll(
    podId: string,
    userId: string,
    query: WorkflowQ
  ): Promise<WorkflowListResult> {
    const conditions = [eq(workflows.podId, podId)]

    const limit = query.limit ?? 20
    const page = query.page ?? 1
    const offset = (page - 1) * limit

    if (query.trashed) {
      conditions.push(isNotNull(workflows.deletedAt))
    } else {
      conditions.push(isNull(workflows.deletedAt))
    }

    if (query.isTemplate !== undefined)
      conditions.push(eq(workflows.isTemplate, query.isTemplate))
    if (query.starred) conditions.push(eq(workflows.starred, true))
    if (query.search)
      conditions.push(ilike(workflows.name, `%${query.search}%`))

    if (query.favorited) {
      const favIds = await this.db
        .select({ workflowId: workflowFavorites.workflowId })
        .from(workflowFavorites)
        .where(
          and(eq(workflowFavorites.userId, userId), eq(workflows.podId, podId))
        )
        .innerJoin(workflows, eq(workflowFavorites.workflowId, workflows.id))

      const ids = favIds.map((r) => r.workflowId)
      if (ids.length === 0) {
        return {
          workflows: [],
          meta: { page: page, limit: limit, total: 0 },
        }
      }
      conditions.push(inArray(workflows.id, ids))
    }

    const t = await this.db
      .select({ total: count() })
      .from(workflows)
      .where(and(...conditions))

    const total = t[0]?.total

    const rows = await this.db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.updatedAt))
      .limit(limit)
      .offset(offset)

    return {
      workflows: rows,
      meta: { page: page, limit: limit, total: total ?? 0 },
    }
  }

  async findById(id: string): Promise<Workflow | null> {
    const [record] = await this.db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async create(workflow: NewWorkflow): Promise<Workflow | null> {
    const [record] = await this.db
      .insert(workflows)
      .values(workflow)
      .returning()

    if (!record) return null

    return record
  }

  async update(
    id: string,
    userId: string,
    workflow: Partial<NewWorkflow>
  ): Promise<Workflow | null> {
    const [record] = await this.db
      .update(workflows)
      .set(workflow)
      .where(and(eq(workflows.id, id), eq(workflows.createdBy, userId)))
      .returning()

    if (!record) return null

    return record
  }
  async delete(id: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.createdBy, userId)))
      .returning()

    if (!row) return false

    return true
  }
}
