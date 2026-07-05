import {
  ConnectionRepository,
  ExecutionRepository,
  PodRepository,
  UserRepository,
  WorkflowRepository,
  WorkspaceRepository,
} from "@linea/shared/contracts"
import { createDb } from "./client.js"
import {
  ConnectionRepositoryImpl,
  UserRepositoryImpl,
  WorkspaceRepositoryImpl,
  ExecutionRepositoryImpl,
  PodRepositoryImpl,
  WorkflowRepositoryImpl,
} from "./repositories/index.js"
interface DatabaseConfig {
  connectionURL: string
}

export class Database {
  readonly connection: ConnectionRepository
  readonly workflow: WorkflowRepository
  readonly execution: ExecutionRepository
  readonly pod: PodRepository
  readonly workspace: WorkspaceRepository
  readonly user: UserRepository

  readonly client: ReturnType<typeof createDb>

  constructor(config: DatabaseConfig) {
    const db = createDb(config.connectionURL)

    // only adding till we migrate
    this.client = db

    this.connection = new ConnectionRepositoryImpl(db)
    this.workflow = new WorkflowRepositoryImpl(db)
    this.execution = new ExecutionRepositoryImpl(db)
    this.pod = new PodRepositoryImpl(db)
    this.workspace = new WorkspaceRepositoryImpl(db)
    this.user = new UserRepositoryImpl(db)
  }
}

export { createDb } from "./client.js"
export type { DrizzleDB } from "./client.js"
export * from "./schema/index.js"
export * from "./repositories/index.js"
