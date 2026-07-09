import { and, count, eq, inArray } from "drizzle-orm"
import { executions } from "../../schema/executions.js"
import { DrizzleDB } from "../../client.js"
import {
  Execution,
  ExecutionRepository,
  NewExecution,
  VariableMap,
} from "@linea/shared/contracts"

export class ExecutionRepositoryImpl implements ExecutionRepository {
  constructor(private readonly db: DrizzleDB) {}

  async countRunning(workspaceId: string): Promise<number> {
    const [activeRow] = await this.db
      .select({ n: count() })
      .from(executions)
      .where(
        and(
          eq(executions.workspaceId, workspaceId),
          inArray(executions.status, ["queued", "running"])
        )
      )

    return activeRow?.n ?? 0
  }

  async start(id: string): Promise<Execution | null> {
    const [record] = await this.db
      .update(executions)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(executions.id, id))
      .returning()

    return record ?? null
  }

  async complete(
    id: string,
    payload: {
      variables: VariableMap
      nodeResults: Execution["nodeResults"]
      output: Execution["output"]
      tokenUsage?: Execution["tokenUsage"]
      finishedAt: Date
    }
  ): Promise<Execution | null> {
    const [record] = await this.db
      .update(executions)
      .set({
        status: "completed",
        variables: payload.variables,
        tokenUsage: payload.tokenUsage,
        finishedAt: payload.finishedAt,
        nodeResults: payload.nodeResults,
        output: payload.output,
        error: null,
      })
      .where(eq(executions.id, id))
      .returning()

    return record ?? null
  }

  async fail(
    id: string,
    payload: {
      error: string
      finishedAt: Date
    }
  ): Promise<Execution | null> {
    const [record] = await this.db
      .update(executions)
      .set({
        status: "failed",
        error: payload.error,
        finishedAt: payload.finishedAt,
      })
      .where(eq(executions.id, id))
      .returning()

    return record ?? null
  }

  async findById(id: string): Promise<Execution | null> {
    const [record] = await this.db
      .select()
      .from(executions)
      .where(eq(executions.id, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async create(workflow: NewExecution): Promise<Execution | null> {
    const [record] = await this.db
      .insert(executions)
      .values(workflow)
      .returning()

    if (!record) return null

    return record
  }

  async update(workflow: NewExecution): Promise<Execution | null> {
    const [record] = await this.db.update(executions).set(workflow).returning()

    if (!record) return null

    return record
  }
  async delete(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(executions)
      .where(eq(executions.id, id))
      .returning()

    if (!row) return false

    return true
  }
}
