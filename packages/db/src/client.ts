import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index"
import { ConnectionRepository } from "./repositories"

export type DrizzleDB = ReturnType<typeof createDb>

export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  return drizzle(client, {
    schema,
    logger: process.env["NODE_ENV"] === "development",
  })
}
