import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, desc } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { notifications } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async findAll(userId: string) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markRead(userId: string, id: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!updated) throw new NotFoundException(`Notification ${id} not found`);
    return updated;
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  }

  async delete(userId: string, id: string) {
    const deleted = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!deleted.length) throw new NotFoundException(`Notification ${id} not found`);
  }

  async create(userId: string, type: string, title: string, body?: string) {
    const [notif] = await this.db
      .insert(notifications)
      .values({ userId, type, title, body: body ?? null })
      .returning();
    return notif;
  }
}
