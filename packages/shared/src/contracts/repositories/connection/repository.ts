import type { AIProviderType } from "@linea/shared"
import { NewProviderConnection, ProviderConnection } from "./types.js"

export interface ConnectionRepository {
  findById(id: string): Promise<ProviderConnection | null>
  findByProvider(
    workspaceId: string,
    provider: AIProviderType
  ): Promise<ProviderConnection | null>

  create(payload: NewProviderConnection): Promise<ProviderConnection | null>
  delete(connectId: string): Promise<void>
  findAll(workspaceId: string): Promise<ProviderConnection[]>
}
