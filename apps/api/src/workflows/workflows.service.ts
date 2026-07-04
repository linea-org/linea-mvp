import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  and,
  eq,
  ilike,
  sql,
  count,
  desc,
  isNull,
  isNotNull,
  gt,
  ne,
} from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { SQL } from 'drizzle-orm';
import type { DrizzleDB, NewWorkflow } from '@linea/db';
import {
  workflows,
  workflowVersions,
  templates,
  workflowFavorites,
  templateUpvotes,
  webhooks,
  workflowPresence,
  users,
} from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { SchedulesService } from '../schedules/schedules.service';
import type { CreateWorkflowDto } from './dto/create-workflow.dto';
import type { UpdateWorkflowDto } from './dto/update-workflow.dto';
import type { ListWorkflowsDto } from './dto/list-workflows.dto';
import type { ListTemplatesDto } from './dto/list-templates.dto';
import type {
  PublishTemplateDto,
  UpdateTemplateDto,
} from './dto/publish-template.dto';
import type { UpdateLogSettingsDto } from './dto/log-settings.dto';

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
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly schedulesService: SchedulesService,
  ) {}

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

  async findAll(podId: string, query: ListWorkflowsDto, userId: string) {
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

    if (query.favorited) {
      const favIds = await this.db
        .select({ workflowId: workflowFavorites.workflowId })
        .from(workflowFavorites)
        .where(
          and(eq(workflowFavorites.userId, userId), eq(workflows.podId, podId)),
        )
        .innerJoin(workflows, eq(workflowFavorites.workflowId, workflows.id));

      const ids = favIds.map((r) => r.workflowId);
      if (ids.length === 0) {
        return {
          workflows: [],
          meta: { page: query.page, limit: query.limit, total: 0 },
        };
      }
      const { inArray } = await import('drizzle-orm');
      conditions.push(inArray(workflows.id, ids));
    }

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

    const shouldVersion = dto.definition && !dto.skipVersion;
    if (shouldVersion) {
      await this.db.insert(workflowVersions).values({
        workflowId: id,
        version: existing.version,
        definition: existing.definition,
        createdBy: userId,
      });
    }

    const { skipVersion: _skip, ...dtoFields } = dto;
    void _skip;
    const [updated] = await this.db
      .update(workflows)
      .set({
        ...dtoFields,
        definition: dto.definition
          ? (redactNodeSecrets(dto.definition) as NewWorkflow['definition'])
          : undefined,
        version: shouldVersion ? existing.version + 1 : existing.version,
        updatedAt: new Date(),
      })
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .returning();

    if (dto.definition) {
      await Promise.all([
        this.schedulesService.syncWorkflowSchedule(podId, id, dto.definition),
        this.syncWorkflowWebhook(podId, id, dto.definition),
      ]);
    }

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

  async undeploy(podId: string, id: string) {
    const [updated] = await this.db
      .update(workflows)
      .set({ deployedAt: null, updatedAt: new Date() })
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .returning();

    if (!updated) throw new NotFoundException(`Workflow ${id} not found`);
    return updated;
  }

  private async syncWorkflowWebhook(
    podId: string,
    workflowId: string,
    definition: unknown,
  ): Promise<void> {
    const nodes: any[] = (definition as any)?.nodes ?? [];
    const startNode = nodes.find((n: any) => n.type === 'start');
    const triggerType = startNode?.data?.triggerType as string | undefined;

    if (triggerType === 'webhook') {
      const [existing] = await this.db
        .select({ id: webhooks.id })
        .from(webhooks)
        .where(eq(webhooks.workflowId, workflowId))
        .limit(1);

      if (!existing) {
        const secretToken = randomBytes(24).toString('hex');
        await this.db
          .insert(webhooks)
          .values({ podId, workflowId, secretToken });
      }
    }
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

  async duplicate(podId: string, id: string, userId: string) {
    const [original] = await this.db
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.podId, podId)))
      .limit(1);
    if (!original) throw new NotFoundException(`Workflow ${id} not found`);

    const [copy] = await this.db
      .insert(workflows)
      .values({
        podId,
        name: `Copy of ${original.name}`,
        description: original.description,
        definition: original.definition as NewWorkflow['definition'],
        isTemplate: false,
        isPublic: false,
        createdBy: userId,
      } satisfies Partial<NewWorkflow> as NewWorkflow)
      .returning();

    return copy;
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

  async restoreVersion(
    podId: string,
    workflowId: string,
    version: number,
    userId: string,
  ) {
    const ver = await this.getVersion(podId, workflowId, version);
    const existing = await this.findOne(podId, workflowId);

    // Snapshot the current state before overwriting
    await this.db.insert(workflowVersions).values({
      workflowId,
      version: existing.version,
      definition: existing.definition,
      createdBy: userId,
    });

    const [updated] = await this.db
      .update(workflows)
      .set({
        definition: ver.definition,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(workflows.id, workflowId), eq(workflows.podId, podId)))
      .returning();

    return updated;
  }

  async createFromTemplate(
    podId: string,
    userId: string,
    templateId: string,
    name?: string,
  ) {
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
      definition = template.definition;
    } else {
      throw new NotFoundException('Template has no workflow definition');
    }

    const [cloned] = await this.db
      .insert(workflows)
      .values({
        podId,
        name: name?.trim() || template.name,
        description,
        definition,
        isTemplate: false,
        isPublic: false,
        clonedFromTemplateId: templateId,
        createdBy: userId,
      })
      .returning();

    // Don't track downloads on internal (built-in) templates
    if (template.source !== 'internal') {
      void this.db
        .update(templates)
        .set({ downloads: sql`downloads + 1` })
        .where(eq(templates.id, templateId));
    }

    return cloned;
  }

  async hardDelete(podId: string, id: string): Promise<void> {
    const [workflow] = await this.db
      .select()
      .from(workflows)
      .where(
        and(
          eq(workflows.id, id),
          eq(workflows.podId, podId),
          isNotNull(workflows.deletedAt),
        ),
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

  async publishToGallery(
    podId: string,
    workflowId: string,
    userId: string,
    dto: PublishTemplateDto,
  ) {
    const workflow = await this.findOne(podId, workflowId);

    // Block publishing if this workflow is an unmodified clone of a template
    if (workflow.clonedFromTemplateId) {
      const [sourceTemplate] = await this.db
        .select({ definition: templates.definition, source: templates.source })
        .from(templates)
        .where(eq(templates.id, workflow.clonedFromTemplateId))
        .limit(1);

      if (sourceTemplate) {
        const workflowHash = JSON.stringify(workflow.definition);
        const templateHash = JSON.stringify(
          sourceTemplate.definition ?? workflow.definition,
        );

        if (workflowHash === templateHash) {
          throw new BadRequestException(
            'This workflow is an unmodified clone of a template. Customise it before publishing to the gallery.',
          );
        }
      }
    }

    const [template] = await this.db
      .insert(templates)
      .values({
        name: dto.name ?? workflow.name,
        description: dto.description ?? workflow.description,
        category: dto.category,
        featured: dto.featured ?? false,
        source: 'community',
        thumbnailUrl: dto.thumbnailUrl ?? null,
        workflowId: workflow.id,
        definition: workflow.definition,
        publishedBy: userId,
        downloads: 0,
      })
      .returning();

    return template;
  }

  async getTemplate(id: string, incrementView = false) {
    const [template] = await this.db
      .select()
      .from(templates)
      .where(eq(templates.id, id))
      .limit(1);

    if (!template) throw new NotFoundException(`Template ${id} not found`);

    if (incrementView) {
      this.incrementTemplateViews(id);
    }

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

    if (!deleted.length)
      throw new NotFoundException(`Template ${id} not found`);
  }

  async favoriteWorkflow(userId: string, workflowId: string): Promise<void> {
    await this.db
      .insert(workflowFavorites)
      .values({ userId, workflowId })
      .onConflictDoNothing();
  }

  async unfavoriteWorkflow(userId: string, workflowId: string): Promise<void> {
    await this.db
      .delete(workflowFavorites)
      .where(
        and(
          eq(workflowFavorites.userId, userId),
          eq(workflowFavorites.workflowId, workflowId),
        ),
      );
  }

  async getWorkflowFavoriteIds(
    userId: string,
    podId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ workflowId: workflowFavorites.workflowId })
      .from(workflowFavorites)
      .innerJoin(workflows, eq(workflowFavorites.workflowId, workflows.id))
      .where(
        and(eq(workflowFavorites.userId, userId), eq(workflows.podId, podId)),
      );

    return rows.map((r) => r.workflowId);
  }

  incrementTemplateViews(id: string): void {
    void this.db
      .update(templates)
      .set({ views: sql`views + 1` })
      .where(eq(templates.id, id));
  }

  async toggleTemplateUpvote(
    userId: string,
    templateId: string,
  ): Promise<{ upvoted: boolean; upvotes: number }> {
    const [existing] = await this.db
      .select()
      .from(templateUpvotes)
      .where(
        and(
          eq(templateUpvotes.userId, userId),
          eq(templateUpvotes.templateId, templateId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .delete(templateUpvotes)
        .where(eq(templateUpvotes.id, existing.id));
      const [t] = await this.db
        .update(templates)
        .set({ upvotes: sql`GREATEST(upvotes - 1, 0)`, updatedAt: new Date() })
        .where(eq(templates.id, templateId))
        .returning({ upvotes: templates.upvotes });
      return { upvoted: false, upvotes: t?.upvotes ?? 0 };
    } else {
      await this.db.insert(templateUpvotes).values({ userId, templateId });
      const [t] = await this.db
        .update(templates)
        .set({ upvotes: sql`upvotes + 1`, updatedAt: new Date() })
        .where(eq(templates.id, templateId))
        .returning({ upvotes: templates.upvotes });
      return { upvoted: true, upvotes: t?.upvotes ?? 0 };
    }
  }

  async updateLogSettings(
    podId: string,
    id: string,
    dto: UpdateLogSettingsDto,
  ) {
    const [updated] = await this.db
      .update(workflows)
      .set({
        logLevel: dto.logLevel,
        logRetentionDays: dto.logRetentionDays ?? null,
        updatedAt: new Date(),
      })
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

  async getUserUpvotedTemplateIds(userId: string): Promise<string[]> {
    try {
      const rows = await this.db
        .select({ templateId: templateUpvotes.templateId })
        .from(templateUpvotes)
        .where(eq(templateUpvotes.userId, userId));

      return rows.map((r) => r.templateId);
    } catch {
      return [];
    }
  }

  async upsertPresence(workflowId: string, userId: string) {
    await this.db
      .insert(workflowPresence)
      .values({ workflowId, userId, lastSeenAt: new Date() })
      .onConflictDoUpdate({
        target: [workflowPresence.workflowId, workflowPresence.userId],
        set: { lastSeenAt: new Date() },
      });

    const cutoff = new Date(Date.now() - 60_000);
    return this.db
      .select({
        userId: workflowPresence.userId,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        lastSeenAt: workflowPresence.lastSeenAt,
      })
      .from(workflowPresence)
      .leftJoin(users, eq(workflowPresence.userId, users.id))
      .where(
        and(
          eq(workflowPresence.workflowId, workflowId),
          ne(workflowPresence.userId, userId),
          gt(workflowPresence.lastSeenAt, cutoff),
        ),
      );
  }

  async listTemplates(query: ListTemplatesDto) {
    const conditions: SQL[] = [];
    if (query.search)
      conditions.push(ilike(templates.name, `%${query.search}%`));
    if (query.category) conditions.push(eq(templates.category, query.category));
    if (query.featured) conditions.push(eq(templates.featured, true));
    if (query.source) conditions.push(eq(templates.source, query.source));

    const rows = await this.db
      .select({
        id: templates.id,
        name: templates.name,
        description: templates.description,
        category: templates.category,
        featured: templates.featured,
        downloads: templates.downloads,
        views: templates.views,
        upvotes: templates.upvotes,
        thumbnailUrl: templates.thumbnailUrl,
        workflowId: templates.workflowId,
        publishedBy: templates.publishedBy,
        source: templates.source,
        prerequisites: templates.prerequisites,
        createdAt: templates.createdAt,
        // Creator info for community templates (LEFT JOIN so internal rows get nulls)
        creatorName: users.name,
        creatorAvatarUrl: users.avatarUrl,
        creatorEmail: users.email,
      })
      .from(templates)
      .leftJoin(users, eq(templates.publishedBy, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(templates.featured), desc(templates.downloads));

    return rows;
  }
}
