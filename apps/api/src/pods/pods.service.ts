import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { pods } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';
import type { CreatePodDto } from './dto/create-pod.dto.js';
import type { UpdatePodDto } from './dto/update-pod.dto.js';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    randomBytes(3).toString('hex')
  );
}

@Injectable()
export class PodsService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async create(workspaceId: string, dto: CreatePodDto) {
    const slug = slugify(dto.name);

    const [pod] = await this.db
      .insert(pods)
      .values({
        workspaceId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
      })
      .returning();

    return pod;
  }

  async findAll(workspaceId: string) {
    return this.db.select().from(pods).where(eq(pods.workspaceId, workspaceId));
  }

  async findOne(workspaceId: string, id: string) {
    const [pod] = await this.db
      .select()
      .from(pods)
      .where(and(eq(pods.id, id), eq(pods.workspaceId, workspaceId)))
      .limit(1);

    if (!pod) throw new NotFoundException(`Pod ${id} not found`);
    return pod;
  }

  async update(workspaceId: string, id: string, dto: UpdatePodDto) {
    await this.findOne(workspaceId, id);

    const [updated] = await this.db
      .update(pods)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(pods.id, id), eq(pods.workspaceId, workspaceId)))
      .returning();

    return updated;
  }

  async delete(workspaceId: string, id: string) {
    await this.findOne(workspaceId, id);

    await this.db
      .delete(pods)
      .where(and(eq(pods.id, id), eq(pods.workspaceId, workspaceId)));
  }
}
