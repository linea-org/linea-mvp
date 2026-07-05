import { eq } from "drizzle-orm"
import { createHash } from "crypto"
import { users } from "../../schema/users.js"
import { DrizzleDB } from "../../client.js"
import { lineaApiKeys } from "../../schema/integrations.js"
import { NewUser, User, UserRepository } from "@linea/shared/contracts"

export class UserRepositoryImpl implements UserRepository {
  constructor(private readonly db: DrizzleDB) {}
  async findByClerkId(id: string): Promise<User | null> {
    const [record] = await this.db
      .select()
      .from(users)

      .where(eq(users.clerkId, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async findByAPIKey(apiKey: string): Promise<User | null> {
    const keyHash = createHash("sha256").update(apiKey).digest("hex")

    const [row] = await this.db
      .select({ user: users, key: lineaApiKeys })
      .from(lineaApiKeys)
      .innerJoin(users, eq(lineaApiKeys.userId, users.id))
      .where(eq(lineaApiKeys.keyHash, keyHash))
      .limit(1)

    if (!row) return null

    const { key } = row
    if (key.revokedAt) return null
    if (key.expiresAt && key.expiresAt < new Date()) return null

    this.db
      .update(lineaApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(lineaApiKeys.keyHash, keyHash))

    return row.user
  }

  async findById(id: string): Promise<User | null> {
    const [record] = await this.db
      .select()
      .from(users)

      .where(eq(users.id, id))
      .limit(1)

    if (!record) return null

    return record
  }

  async create(payload: NewUser): Promise<User | null> {
    const [record] = await this.db.insert(users).values(payload).returning()

    if (!record) return null

    return record
  }

  async update(payload: NewUser): Promise<User | null> {
    const [record] = await this.db.update(users).set(payload).returning()

    if (!record) return null

    return record
  }
  async delete(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning()

    if (!row) return false

    return true
  }
}
