import { eq } from "drizzle-orm"
import { executions } from "../../schema/executions.js"
import { DrizzleDB } from "../../client.js"
import {
  Execution,
  ExecutionRepository,
  NewExecution,
} from "@linea/shared/contracts"

export class ExecutionRepositoryImpl implements ExecutionRepository {
  constructor(private readonly db: DrizzleDB) {}

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
