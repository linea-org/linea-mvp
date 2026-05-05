import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { and, eq, ilike, sql, count, desc, isNull, isNotNull } from 'drizzle-orm';
import type { DrizzleDB, WorkspaceMember, NewWorkflow } from '@linea/db';
import { workflows, workflowVersions, templates } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto';
import type { ListWorkflowsDto } from './dto/list-workflows.dto';

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

@Injectable()
export class WorkflowsService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async create(spaceId: string, userId: string, membership: WorkspaceMember, dto: CreateWorkflowDto) {
    assertMinRole(membership, 'editor');

    const [workflow] = await this.db
      .insert(workflows)
      .values({
        spaceId,
        name: dto.name,
        description: dto.description ?? null,
        definition: (dto.definition ?? { nodes: [], edges: [] }) as NewWorkflow['definition'],
        isTemplate: dto.isTemplate ?? false,
        isPublic: dto.isPublic ?? false,
        createdBy: userId,
      } satisfies Partial<NewWorkflow> as NewWorkflow)
      .returning();

    return workflow;
  }

  async findAll(spaceId: string, query: ListWorkflowsDto) {
    const conditions = [eq(workflows.spaceId, spaceId)];

    if (query.trashed) {
      conditions.push(isNotNull(workflows.deletedAt));
    } else {
      conditions.push(isNull(workflows.deletedAt));
    }

    if (query.isTemplate !== undefined) conditions.push(eq(workflows.isTemplate, query.isTemplate));
    if (query.starred) conditions.push(eq(workflows.starred, true));
    if (query.search) conditions.push(ilike(workflows.name, `%${query.search}%`));

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(workflows)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.updatedAt))
      .limit(query.limit)
      .offset(query.offset);

    return { workflows: rows, meta: { page: query.page, limit: query.limit, total: total ?? 0 } };
  }

  async findOne(spaceId: string, id: string) {
    const [workflow] = await this.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId)))
      .limit(1);

    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    return workflow;
  }

  async update(spaceId: string, id: string, membership: WorkspaceMember, dto: UpdateWorkflowDto) {
    assertMinRole(membership, 'editor');

    const existing = await this.findOne(spaceId, id);

    if (dto.definition) {
      await this.db.insert(workflowVersions).values({
        workflowId: id,
        version: existing.version,
        definition: existing.definition,
        createdBy: membership.userId,
      });
    }

    const [updated] = await this.db
      .update(workflows)
      .set({
        ...dto,
        definition: dto.definition as NewWorkflow['definition'] | undefined,
        version: dto.definition ? existing.version + 1 : existing.version,
        updatedAt: new Date(),
      })
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId)))
      .returning();

    return updated;
  }

  async delete(spaceId: string, id: string, membership: WorkspaceMember) {
    assertMinRole(membership, 'editor');

    const deleted = await this.db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId)))
      .returning();

    if (!deleted.length) throw new NotFoundException(`Workflow ${id} not found`);
  }

  async deploy(spaceId: string, id: string, membership: WorkspaceMember) {
    assertMinRole(membership, 'admin');

    const [updated] = await this.db
      .update(workflows)
      .set({ deployedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async star(spaceId: string, id: string, starred: boolean) {
    const [updated] = await this.db
      .update(workflows)
      .set({ starred, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async trash(spaceId: string, id: string, membership: WorkspaceMember) {
    assertMinRole(membership, 'editor');

    const [updated] = await this.db
      .update(workflows)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId), isNull(workflows.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async restore(spaceId: string, id: string, membership: WorkspaceMember) {
    assertMinRole(membership, 'editor');

    const [updated] = await this.db
      .update(workflows)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.spaceId, spaceId), isNotNull(workflows.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found in trash`);
    return updated;
  }

  async getVersions(spaceId: string, workflowId: string) {
    await this.findOne(spaceId, workflowId);

    return this.db
      .select({
        id: workflowVersions.id,
        version: workflowVersions.version,
        createdBy: workflowVersions.createdBy,
        createdAt: workflowVersions.createdAt,
      })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflowId))
      .orderBy(desc(workflowVersions.version));
  }

  async getVersion(spaceId: string, workflowId: string, version: number) {
    await this.findOne(spaceId, workflowId);

    const [ver] = await this.db
      .select()
      .from(workflowVersions)
      .where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.version, version)))
      .limit(1);

    if (!ver) throw new NotFoundException(`Version ${version} not found`);
    return ver;
  }

  async createFromTemplate(spaceId: string, userId: string, membership: WorkspaceMember, templateId: string) {
    assertMinRole(membership, 'editor');

    const [template] = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    if (!template) throw new NotFoundException(`Template ${templateId} not found`);
    if (!template.workflowId) throw new NotFoundException('Template has no associated workflow');

    const [sourceWorkflow] = await this.db
      .select()
      .from(workflows)
      .where(eq(workflows.id, template.workflowId))
      .limit(1);

    if (!sourceWorkflow) throw new NotFoundException('Template workflow not found');

    const [cloned] = await this.db
      .insert(workflows)
      .values({
        spaceId,
        name: `${sourceWorkflow.name} (from template)`,
        description: sourceWorkflow.description,
        definition: sourceWorkflow.definition,
        isTemplate: false,
        isPublic: false,
        createdBy: userId,
      })
      .returning();

    void this.db
      .update(templates)
      .set({ downloads: sql`downloads + 1` })
      .where(eq(templates.id, templateId));

    return cloned;
  }

  async listTemplates(query: ListWorkflowsDto) {
    const conditions = [eq(workflows.isTemplate, true), eq(workflows.isPublic, true), isNull(workflows.deletedAt)];

    if (query.search) conditions.push(ilike(workflows.name, `%${query.search}%`));

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(workflows)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(workflows)
      .where(and(...conditions))
      .orderBy(desc(workflows.updatedAt))
      .limit(query.limit)
      .offset(query.offset);

    return { workflows: rows, meta: { page: query.page, limit: query.limit, total: total ?? 0 } };
  }
}
