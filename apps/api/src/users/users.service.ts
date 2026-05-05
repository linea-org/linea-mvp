import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import type { DrizzleDB, User } from '@linea/db';
import { users, lineaApiKeys } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

interface ClerkUserPayload {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async findOrCreateFromClerk(clerkId: string): Promise<User> {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing) return existing;

    // User exists in Clerk but not yet synced — create a minimal record.
    // Full sync happens via the Clerk webhook.
    const [created] = await this.db
      .insert(users)
      .values({ clerkId, email: `${clerkId}@pending.linea` })
      .returning();

    return created;
  }

  async upsertFromClerk(payload: ClerkUserPayload): Promise<User> {
    const primaryEmail = payload.email_addresses.find(
      (e) => e.id === payload.primary_email_address_id,
    );
    const email = primaryEmail?.email_address ?? `${payload.id}@pending.linea`;
    const name =
      [payload.first_name, payload.last_name].filter(Boolean).join(' ') || null;

    const [upserted] = await this.db
      .insert(users)
      .values({
        clerkId: payload.id,
        email,
        name,
        avatarUrl: payload.image_url,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          email,
          name,
          avatarUrl: payload.image_url,
          updatedAt: new Date(),
        },
      })
      .returning();

    return upserted;
  }

  async deleteByClerkId(clerkId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.clerkId, clerkId));
  }

  async findByApiKey(rawKey: string): Promise<User | null> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const [row] = await this.db
      .select({ user: users })
      .from(lineaApiKeys)
      .innerJoin(users, eq(lineaApiKeys.userId, users.id))
      .where(eq(lineaApiKeys.keyHash, keyHash))
      .limit(1);

    if (!row) return null;

    // Update last used timestamp without blocking the response
    void this.db
      .update(lineaApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(lineaApiKeys.keyHash, keyHash));

    return row.user;
  }

  async findById(id: string): Promise<User> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateProfile(
    id: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<User> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
