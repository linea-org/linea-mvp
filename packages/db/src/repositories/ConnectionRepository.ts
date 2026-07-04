import { and, eq } from "drizzle-orm"
import { DrizzleDB } from "../client"
import {
  NewProviderConnection,
  ProviderConnection,
  providerConnections,
} from "../schema"
import { AIProviderType, IntegrationType } from "@linea/shared"

interface ConnectionRepositoryInter {
  findById(id: string): Promise<ProviderConnection | null>
  findByProvider(
    workspaceId: string,
    provider: AIProviderType
  ): Promise<ProviderConnection | null>

  create(payload: NewProviderConnection): Promise<ProviderConnection | null>
  delete(connectId: string): Promise<void>

  findAll(workspaceId: string): Promise<ProviderConnection[]>
}

export class ConnectionRepository implements ConnectionRepositoryInter {
  constructor(private readonly db: DrizzleDB) {}

  async findById(id: string): Promise<ProviderConnection | null> {
    const [record] = await this.db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async findByProvider(
    workspaceId: string,
    provider: AIProviderType | IntegrationType
  ): Promise<ProviderConnection | null> {
    const [record] = await this.db
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.workspaceId, workspaceId),
          eq(providerConnections.provider, provider)
        )
      )
      .limit(1)

    if (!record) return null

    return record
  }

  async create(
    payload: NewProviderConnection
  ): Promise<ProviderConnection | null> {
    const [record] = await this.db
      .insert(providerConnections)
      .values(payload)
      .returning()

    if (!record) return null

    return record
  }

  async delete(connectId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: providerConnections.id })
      .from(providerConnections)
      .where(and(eq(providerConnections.id, connectId)))
      .limit(1)

    if (!row) throw new Error(`Provider Connect ${connectId} not found`)

    await this.db
      .delete(providerConnections)
      .where(eq(providerConnections.id, connectId))
  }
  async findAll(workspaceId: string): Promise<ProviderConnection[]> {
    return this.db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.workspaceId, workspaceId))
  }
}
