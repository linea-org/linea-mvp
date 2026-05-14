import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  and,
  eq,
  ilike,
  sql,
  count,
  desc,
  isNull,
  isNotNull,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { DrizzleDB, NewWorkflow } from '@linea/db';
import { workflows, workflowVersions, templates, templateFavorites } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto';
import type { ListWorkflowsDto } from './dto/list-workflows.dto';
import type { ListTemplatesDto } from './dto/list-templates.dto';
import type { PublishTemplateDto, UpdateTemplateDto } from './dto/publish-template.dto';

const SECRET_NODE_FIELDS = ['accessToken', 'apiKey', 'secretToken', 'password'];

function redactNodeSecrets(definition: unknown): unknown {
  if (!definition || typeof definition !== 'object') return definition;
  const def = definition as { nodes?: unknown[] };
  if (!Array.isArray(def.nodes)) return definition;
  return {
    ...def,
    nodes: def.nodes.map((node: any) => {
      if (!node?.data || typeof node.data !== 'object') return node;
      const cleanData = { ...node.data };
      for (const field of SECRET_NODE_FIELDS) delete cleanData[field];
      return { ...node, data: cleanData };
    }),
  };
}

@Injectable()
export class WorkflowsService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async create(podId: string, userId: string, dto: CreateWorkflowDto) {
    const [workflow] = await this.db
      .insert(workflows)
      .values({
        podId,
        name: dto.name,
        description: dto.description ?? null,
        definition: redactNodeSecrets(
          dto.definition ?? { nodes: [], edges: [] },
        ) as NewWorkflow['definition'],
        isTemplate: dto.isTemplate ?? false,
        isPublic: dto.isPublic ?? false,
        createdBy: userId,
      } satisfies Partial<NewWorkflow> as NewWorkflow)
      .returning();

    return workflow;
  }

  async findAll(podId: string, query: ListWorkflowsDto) {
    const conditions = [eq(workflows.podId, podId)];

    if (query.trashed) {
      conditions.push(isNotNull(workflows.deletedAt));
    } else {
      conditions.push(isNull(workflows.deletedAt));
    }

    if (query.isTemplate !== undefined)
      conditions.push(eq(workflows.isTemplate, query.isTemplate));
    if (query.starred) conditions.push(eq(workflows.starred, true));
    if (query.search)
      conditions.push(ilike(workflows.name, `%${query.search}%`));

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

    return {
      workflows: rows,
      meta: { page: query.page, limit: query.limit, total: total ?? 0 },
    };
  }

  async findOne(podId: string, id: string) {
    const [workflow] = await this.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .limit(1);

    if (!workflow) throw new NotFoundException(`Workflow ${id} not found`);
    return workflow;
  }

  async update(
    podId: string,
    id: string,
    userId: string,
    dto: UpdateWorkflowDto,
  ) {
    const existing = await this.findOne(podId, id);

    if (dto.definition) {
      await this.db.insert(workflowVersions).values({
        workflowId: id,
        version: existing.version,
        definition: existing.definition,
        createdBy: userId,
      });
    }

    const [updated] = await this.db
      .update(workflows)
      .set({
        ...dto,
        definition: dto.definition
          ? (redactNodeSecrets(dto.definition) as NewWorkflow['definition'])
          : undefined,
        version: dto.definition ? existing.version + 1 : existing.version,
        updatedAt: new Date(),
      })
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .returning();

    return updated;
  }

  async delete(podId: string, id: string) {
    const deleted = await this.db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .returning();

    if (!deleted.length)
      throw new NotFoundException(`Workflow ${id} not found`);
  }

  async deploy(podId: string, id: string) {
    const [updated] = await this.db
      .update(workflows)
      .set({ deployedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async star(podId: string, id: string, starred: boolean) {
    const [updated] = await this.db
      .update(workflows)
      .set({ starred, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async trash(podId: string, id: string) {
    const [updated] = await this.db
      .update(workflows)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(workflows.id, id),
          eq(workflows.podId, podId),
          isNull(workflows.deletedAt),
        ),
      )
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async restore(podId: string, id: string) {
    const [updated] = await this.db
      .update(workflows)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(workflows.id, id),
          eq(workflows.podId, podId),
          isNotNull(workflows.deletedAt),
        ),
      )
      .returning();

    if (!updated)
      throw new NotFoundException(`Workflow ${id} not found in trash`);
    return updated;
  }

  async getVersions(podId: string, workflowId: string) {
    await this.findOne(podId, workflowId);

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

  async getVersion(podId: string, workflowId: string, version: number) {
    await this.findOne(podId, workflowId);

    const [ver] = await this.db
      .select()
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.workflowId, workflowId),
          eq(workflowVersions.version, version),
        ),
      )
      .limit(1);

    if (!ver) throw new NotFoundException(`Version ${version} not found`);
    return ver;
  }

  async createFromTemplate(podId: string, userId: string, templateId: string) {
    const [template] = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, templateId))
      .limit(1);

    if (!template)
      throw new NotFoundException(`Template ${templateId} not found`);

    let definition: NewWorkflow['definition'];
    let description: string | null = template.description ?? null;

    if (template.workflowId) {
      const [sourceWorkflow] = await this.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, template.workflowId))
        .limit(1);

      if (!sourceWorkflow)
        throw new NotFoundException('Template workflow not found');
      definition = sourceWorkflow.definition;
      description = sourceWorkflow.description ?? description;
    } else if (template.definition) {
      definition = template.definition as NewWorkflow['definition'];
    } else {
      throw new NotFoundException('Template has no workflow definition');
    }

    const [cloned] = await this.db
      .insert(workflows)
      .values({
        podId,
        name: template.name,
        description,
        definition,
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

  async hardDelete(podId: string, id: string): Promise<void> {
    const [workflow] = await this.db
      .select()
      .from(workflows)
      .where(
        and(eq(workflows.id, id), eq(workflows.podId, podId), isNotNull(workflows.deletedAt)),
      )
      .limit(1);

    if (!workflow)
      throw new NotFoundException(`Workflow ${id} not found in trash`);

    await this.db.delete(workflows).where(eq(workflows.id, id));
  }

  async setTemplate(podId: string, id: string, isTemplate: boolean) {
    const [updated] = await this.db
      .update(workflows)
      .set({ isTemplate, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId), isNull(workflows.deletedAt)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  async publishToGallery(
    podId: string,
    workflowId: string,
    userId: string,
    dto: PublishTemplateDto,
  ) {
    const workflow = await this.findOne(podId, workflowId);

    const [template] = await this.db
      .insert(templates)
      .values({
        name: dto.name ?? workflow.name,
        description: dto.description ?? workflow.description,
        category: dto.category,
        featured: dto.featured ?? false,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        workflowId: workflow.id,
        definition: workflow.definition,
        publishedBy: userId,
        downloads: 0,
      })
      .returning();

    return template;
  }

  async getTemplate(id: string) {
    const [template] = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException(`Template ${id} not found`);
    return template;
  }

  async updateGalleryTemplate(id: string, dto: UpdateTemplateDto) {
    const [updated] = await this.db
      .update(templates)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Template ${id} not found`);
    return updated;
  }

  async deleteGalleryTemplate(id: string): Promise<void> {
    const deleted = await this.db
      .delete(templates)
      .where(eq(templates.id, id))
      .returning();

    if (!deleted.length) throw new NotFoundException(`Template ${id} not found`);
  }

  async favoriteTemplate(userId: string, templateId: string): Promise<void> {
    // Verify template exists
    await this.getTemplate(templateId);
    await this.db
      .insert(templateFavorites)
      .values({ userId, templateId })
      .onConflictDoNothing();
  }

  async unfavoriteTemplate(userId: string, templateId: string): Promise<void> {
    await this.db
      .delete(templateFavorites)
      .where(
        and(
          eq(templateFavorites.userId, userId),
          eq(templateFavorites.templateId, templateId),
        ),
      );
  }

  async getFavoriteIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ templateId: templateFavorites.templateId })
      .from(templateFavorites)
      .where(eq(templateFavorites.userId, userId));

    return rows.map((r) => r.templateId);
  }

  async listTemplates(query: ListTemplatesDto) {
    const conditions: SQL[] = [];
    if (query.search)
      conditions.push(ilike(templates.name, `%${query.search}%`));
    if (query.category) conditions.push(eq(templates.category, query.category));
    if (query.featured) conditions.push(eq(templates.featured, true));

    const rows = await this.db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        category: templates.category,
        featured: templates.featured,
        downloads: templates.downloads,
        thumbnailUrl: templates.thumbnailUrl,
        workflowId: templates.workflowId,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(templates.featured), desc(templates.downloads));

    return rows;
  }
}
