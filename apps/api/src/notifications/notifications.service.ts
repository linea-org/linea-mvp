import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { and, eq, desc, isNull, or } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { notifications } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

@Injectable()
export class NotificationsService {
  /** Per-user SSE subjects. Key: `userId:workspaceId` */
  private readonly streams = new Map<string, Subject<void>>();

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  /** Get (or create) the SSE subject for a user+workspace pair. */
  getStream(userId: string, workspaceId: string): Subject<void> {
    const key = `${userId}:${workspaceId}`;
    if (!this.streams.has(key)) this.streams.set(key, new Subject<void>());
    return this.streams.get(key)!;
  }

  async findAll(userId: string, workspaceId: string) {
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          or(
            eq(notifications.workspaceId, workspaceId),
            isNull(notifications.workspaceId),
          ),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(500);
  }

  async countUnread(userId: string, workspaceId: string): Promise<number> {
    const rows = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false),
          or(
            eq(notifications.workspaceId, workspaceId),
            isNull(notifications.workspaceId),
          ),
        ),
      );
    return rows.length;
  }

  async markRead(userId: string, workspaceId: string, id: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          or(
            eq(notifications.workspaceId, workspaceId),
            isNull(notifications.workspaceId),
          ),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundException(`Notification ${id} not found`);
    return updated;
  }

  async markAllRead(userId: string, workspaceId: string) {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false),
          or(
            eq(notifications.workspaceId, workspaceId),
            isNull(notifications.workspaceId),
          ),
        ),
      );
  }

  async delete(userId: string, workspaceId: string, id: string) {
    const deleted = await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          or(
            eq(notifications.workspaceId, workspaceId),
            isNull(notifications.workspaceId),
          ),
        ),
      )
      .returning();

    if (!deleted.length)
      throw new NotFoundException(`Notification ${id} not found`);
  }

  async create(
    userId: string,
    type: string,
    title: string,
    body?: string,
    workspaceId?: string,
    resourceUrl?: string,
  ) {
    const [notif] = await this.db
      .insert(notifications)
      .values({
        userId,
        workspaceId: workspaceId ?? null,
        type,
        title,
        body: body ?? null,
        resourceUrl: resourceUrl ?? null,
      })
      .returning();

    // Push a signal to any open SSE stream for this user+workspace
    if (workspaceId) {
      const key = `${userId}:${workspaceId}`;
      this.streams.get(key)?.next();
    }

    return notif;
  }
}
