import { createDb } from "./client"
import { ConnectionRepository } from "./repositories/ConnectionRepository"

interface DatabaseConfig {
  connectionURL: string
}

export class Database {
  readonly connection: ConnectionRepository

  constructor(config: DatabaseConfig) {
    const db = createDb(config.connectionURL)
    this.connection = new ConnectionRepository(db)
  }
}

export { createDb } from "./client"
export type { DrizzleDB } from "./client"
export * from "./schema/index"
export * from "./repositories/index"
