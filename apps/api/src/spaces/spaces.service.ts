import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { DrizzleDB, WorkspaceMember } from '@linea/db';
import { spaces } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateSpaceDto } from './dto/create-space.dto';
import type { UpdateSpaceDto } from './dto/update-space.dto';

const ROLE_LEVEL: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

function assertMinRole(membership: WorkspaceMember, minimum: 'owner' | 'admin' | 'editor') {
  if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[minimum]) {
    throw new ForbiddenException(`This action requires the '${minimum}' role or higher`);
  }
}

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
export class SpacesService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async create(workspaceId: string, _userId: string, dto: CreateSpaceDto) {
    const slug = slugify(dto.name);

    const [space] = await this.db
      .insert(spaces)
      .values({ workspaceId, name: dto.name, slug, description: dto.description ?? null })
      .returning();

    return space!;
  }

  async findAll(workspaceId: string) {
    return this.db.select().from(spaces).where(eq(spaces.workspaceId, workspaceId));
  }

  async findOne(workspaceId: string, id: string) {
    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.id, id), eq(spaces.workspaceId, workspaceId)))
      .limit(1);

    if (!space) throw new NotFoundException(`Space ${id} not found`);
    return space;
  }

  async update(workspaceId: string, id: string, membership: WorkspaceMember, dto: UpdateSpaceDto) {
    assertMinRole(membership, 'editor');
    await this.findOne(workspaceId, id);

    const [updated] = await this.db
      .update(spaces)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(spaces.id, id), eq(spaces.workspaceId, workspaceId)))
      .returning();

    return updated!;
  }

  async delete(workspaceId: string, id: string, membership: WorkspaceMember) {
    assertMinRole(membership, 'admin');
    await this.findOne(workspaceId, id);

    await this.db
      .delete(spaces)
      .where(and(eq(spaces.id, id), eq(spaces.workspaceId, workspaceId)));
  }
}
