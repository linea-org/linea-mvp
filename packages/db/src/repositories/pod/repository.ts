import { eq } from "drizzle-orm"
import { pods } from "../../schema/pods.js"
import { DrizzleDB } from "../../client.js"
import { NewPod, Pod, PodRepository } from "@linea/shared/contracts"

export class PodRepositoryImpl implements PodRepository {
  constructor(private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<Pod | null> {
    const [record] = await this.db
      .select()
      .from(pods)
      .where(eq(pods.id, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async create(pod: NewPod): Promise<Pod | null> {
    const [record] = await this.db.insert(pods).values(pod).returning()

    if (!record) return null

    return record
  }

  async update(pod: NewPod): Promise<Pod | null> {
    const [record] = await this.db.update(pods).set(pod).returning()

    if (!record) return null

    return record
  }
  async delete(id: string): Promise<boolean> {
    const [row] = await this.db.delete(pods).where(eq(pods.id, id)).returning()

    if (!row) return false

    return true
  }
}
