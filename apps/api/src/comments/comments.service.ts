import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import {
  workflowComments,
  commentReactions,
  users,
  workflows,
} from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '😂', '😮', '😢', '🎉']);

@Injectable()
export class CommentsService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  private async assertWorkflowInPod(
    workflowId: string,
    podId: string,
  ): Promise<void> {
    const [row] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.podId, podId)))
      .limit(1);
    if (!row) throw new NotFoundException('Workflow not found');
  }

  async findAll(workflowId: string, podId: string, userId: string) {
    await this.assertWorkflowInPod(workflowId, podId);
    const rows = await this.db
      .select({
        id: workflowComments.id,
        nodeId: workflowComments.nodeId,
        parentId: workflowComments.parentId,
        userId: workflowComments.userId,
        userClerkId: users.clerkId,
        userName: users.name,
        userEmail: users.email,
        userAvatarUrl: users.avatarUrl,
        body: workflowComments.body,
        resolved: workflowComments.resolved,
        pinned: workflowComments.pinned,
        createdAt: workflowComments.createdAt,
      })
      .from(workflowComments)
      .leftJoin(users, eq(workflowComments.userId, users.id))
      .where(eq(workflowComments.workflowId, workflowId))
      .orderBy(workflowComments.createdAt);

    const reactions = await this.db
      .select({
        commentId: commentReactions.commentId,
        emoji: commentReactions.emoji,
        userId: commentReactions.userId,
      })
      .from(commentReactions)
      .where(
        sql`${commentReactions.commentId} IN (SELECT id FROM workflow_comments WHERE workflow_id = ${workflowId})`,
      );

    const reactionMap = new Map<
      string,
      { emoji: string; count: number; reacted: boolean }[]
    >();
    for (const r of reactions) {
      if (!reactionMap.has(r.commentId)) reactionMap.set(r.commentId, []);
      const list = reactionMap.get(r.commentId)!;
      const existing = list.find((x) => x.emoji === r.emoji);
      if (existing) {
        existing.count += 1;
        if (r.userId === userId) existing.reacted = true;
      } else {
        list.push({ emoji: r.emoji, count: 1, reacted: r.userId === userId });
      }
    }

    const topLevel = rows.filter((r) => r.parentId === null);
    const childMap = new Map<string, typeof rows>();
    for (const r of rows) {
      if (r.parentId) {
        if (!childMap.has(r.parentId)) childMap.set(r.parentId, []);
        childMap.get(r.parentId)!.push(r);
      }
    }

    const buildThread = (comment: (typeof rows)[0]): unknown => ({
      ...comment,
      reactions: reactionMap.get(comment.id) ?? [],
      replies: (childMap.get(comment.id) ?? []).map(buildThread),
    });

    return topLevel.map(buildThread);
  }

  async create(
    workflowId: string,
    podId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    await this.assertWorkflowInPod(workflowId, podId);
    if (dto.parentId) {
      const [parent] = await this.db
        .select()
        .from(workflowComments)
        .where(
          and(
            eq(workflowComments.id, dto.parentId),
            eq(workflowComments.workflowId, workflowId),
          ),
        );
      if (!parent) throw new NotFoundException('Parent comment not found');
    }

    const [comment] = await this.db
      .insert(workflowComments)
      .values({
        workflowId,
        nodeId: dto.nodeId ?? null,
        parentId: dto.parentId ?? null,
        userId,
        body: dto.body,
      })
      .returning();

    return comment;
  }

  async update(
    workflowId: string,
    podId: string,
    userId: string,
    id: string,
    dto: UpdateCommentDto,
  ) {
    await this.assertWorkflowInPod(workflowId, podId);
    const [existing] = await this.db
      .select()
      .from(workflowComments)
      .where(
        and(
          eq(workflowComments.id, id),
          eq(workflowComments.workflowId, workflowId),
        ),
      );

    if (!existing) throw new NotFoundException('Comment not found');
    if (dto.body !== undefined && existing.userId !== userId) {
      throw new ForbiddenException('Only the author can edit comment text');
    }

    const [updated] = await this.db
      .update(workflowComments)
      .set({
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.resolved !== undefined ? { resolved: dto.resolved } : {}),
        ...(dto.pinned !== undefined ? { pinned: dto.pinned } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workflowComments.id, id))
      .returning();

    return updated;
  }

  async remove(workflowId: string, podId: string, userId: string, id: string) {
    await this.assertWorkflowInPod(workflowId, podId);
    const [existing] = await this.db
      .select()
      .from(workflowComments)
      .where(
        and(
          eq(workflowComments.id, id),
          eq(workflowComments.workflowId, workflowId),
        ),
      );

    if (!existing) throw new NotFoundException('Comment not found');
    if (existing.userId !== userId)
      throw new ForbiddenException('Only the author can delete this comment');

    await this.db.delete(workflowComments).where(eq(workflowComments.id, id));
  }

  async react(
    workflowId: string,
    podId: string,
    userId: string,
    commentId: string,
    emoji: string,
  ) {
    await this.assertWorkflowInPod(workflowId, podId);
    if (!ALLOWED_EMOJIS.has(emoji))
      throw new ForbiddenException('Emoji not allowed');

    const [comment] = await this.db
      .select()
      .from(workflowComments)
      .where(
        and(
          eq(workflowComments.id, commentId),
          eq(workflowComments.workflowId, workflowId),
        ),
      );

    if (!comment) throw new NotFoundException('Comment not found');

    const [existing] = await this.db
      .select()
      .from(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, commentId),
          eq(commentReactions.userId, userId),
          eq(commentReactions.emoji, emoji),
        ),
      );

    if (existing) {
      await this.db
        .delete(commentReactions)
        .where(eq(commentReactions.id, existing.id));
      return { toggled: false };
    }

    await this.db.insert(commentReactions).values({ commentId, userId, emoji });
    return { toggled: true };
  }
}
