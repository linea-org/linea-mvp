import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, eq, or, sql } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { DrizzleDB } from '@linea/db';
import { memories, mcpServers, secrets, oauthConnections } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module.js';
import { AIService } from '../../services/ai/ai.service.js';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('ENCRYPTION_KEY');
    if (!raw && process.env['NODE_ENV'] === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production');
    }
    const keySource = raw ?? 'default-dev-key-do-not-use-in-production!!';
    // Prefer hex-encoded 64-char key (decodes to 32 bytes); fall back to UTF-8 pad
    if (keySource.length === 64 && /^[0-9a-fA-F]+$/.test(keySource)) {
      this.encryptionKey = Buffer.from(keySource, 'hex');
    } else {
      this.encryptionKey = Buffer.alloc(32);
      Buffer.from(keySource, 'utf8').copy(this.encryptionKey);
    }
  }

  async loadForExecution(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    sessionKey?: string,
  ): Promise<Record<string, any>> {
    try {
      const scopeFilters = [
        and(eq(memories.scope, 'thread'), eq(memories.threadId, threadId)),
        ...(workflowId
          ? [
              and(
                eq(memories.scope, 'workflow'),
                eq(memories.workflowId, workflowId),
              ),
            ]
          : []),
        ...(workflowId && sessionKey
          ? [
              and(
                eq(memories.scope, 'session'),
                eq(memories.workflowId, workflowId),
                eq(memories.sessionKey, sessionKey),
              ),
            ]
          : []),
      ];

      const rows = await this.db
        .select({ content: memories.content, scope: memories.scope })
        .from(memories)
        .where(and(eq(memories.workspaceId, workspaceId), or(...scopeFilters)));

      // Merge: workflow → session → thread (later takes precedence)
      const priority = {
        workflow: 0,
        session: 1,
        thread: 2,
        user: 1,
      } as Record<string, number>;
      const sorted = [...rows].sort(
        (a, b) => (priority[a.scope] ?? 0) - (priority[b.scope] ?? 0),
      );

      let merged: Record<string, any> = {};
      for (const row of sorted) {
        try {
          const parsed = JSON.parse(row.content);
          if (parsed && typeof parsed === 'object')
            merged = { ...merged, ...parsed };
        } catch {
          /* skip */
        }
      }

      return merged;
    } catch (err) {
      this.logger.warn(`Failed to load memory for thread ${threadId}: ${err}`);
      return {};
    }
  }

  async saveFromExecution(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    memory: Record<string, any>,
  ): Promise<void> {
    if (!memory || Object.keys(memory).length === 0) return;

    try {
      await this.db
        .delete(memories)
        .where(
          and(
            eq(memories.workspaceId, workspaceId),
            eq(memories.scope, 'thread'),
            eq(memories.threadId, threadId),
          ),
        );

      await this.db.insert(memories).values({
        workspaceId,
        workflowId: workflowId ?? null,
        threadId,
        scope: 'thread',
        content: JSON.stringify(memory),
      });
    } catch (err) {
      this.logger.warn(`Failed to save memory for thread ${threadId}: ${err}`);
    }
  }

  /**
   * Explicit write from a Memory node in write mode.
   * Session scope uses sessionKey for per-caller isolation (B2B pattern).
   */
  async writeEntry(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    scope: 'thread' | 'session' | 'workflow',
    sessionKey: string | undefined,
    key: string,
    value: unknown,
  ): Promise<void> {
    try {
      const content = JSON.stringify({ [key]: value });

      const matchConditions = [
        eq(memories.workspaceId, workspaceId),
        eq(memories.scope, scope),
        sql`${memories.metadata}->>'memoryKey' = ${key}`,
      ];
      if (scope === 'thread')
        matchConditions.push(eq(memories.threadId, threadId));
      if (scope === 'workflow' && workflowId)
        matchConditions.push(eq(memories.workflowId, workflowId));
      if (scope === 'session' && workflowId && sessionKey) {
        matchConditions.push(eq(memories.workflowId, workflowId));
        matchConditions.push(eq(memories.sessionKey, sessionKey));
      }

      await this.db.delete(memories).where(and(...matchConditions));

      await this.db.insert(memories).values({
        workspaceId,
        workflowId: workflowId ?? null,
        threadId,
        sessionKey: scope === 'session' ? (sessionKey ?? null) : null,
        scope,
        content,
        source: 'manual',
        metadata: { memoryKey: key, value },
      });
    } catch (err) {
      this.logger.warn(`writeEntry failed for key "${key}": ${err}`);
    }
  }

  /**
   * Explicit delete of a keyed memory entry.
   */
  async deleteEntry(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    scope: 'thread' | 'session' | 'workflow',
    sessionKey: string | undefined,
    key: string,
  ): Promise<void> {
    try {
      const matchConditions = [
        eq(memories.workspaceId, workspaceId),
        eq(memories.scope, scope),
        sql`${memories.metadata}->>'memoryKey' = ${key}`,
      ];
      if (scope === 'thread')
        matchConditions.push(eq(memories.threadId, threadId));
      if (scope === 'workflow' && workflowId)
        matchConditions.push(eq(memories.workflowId, workflowId));
      if (scope === 'session' && workflowId && sessionKey) {
        matchConditions.push(eq(memories.workflowId, workflowId));
        matchConditions.push(eq(memories.sessionKey, sessionKey));
      }

      await this.db.delete(memories).where(and(...matchConditions));
    } catch (err) {
      this.logger.warn(`deleteEntry failed for key "${key}": ${err}`);
    }
  }

  /**
   * Delete all memory entries for the given scope. Called by the Memory node's clear mode.
   */
  async clearEntries(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    scope: 'thread' | 'session' | 'workflow',
    sessionKey: string | undefined,
  ): Promise<void> {
    try {
      const conditions: ReturnType<typeof eq>[] = [
        eq(memories.workspaceId, workspaceId),
        eq(memories.scope, scope),
      ];
      if (scope === 'thread') conditions.push(eq(memories.threadId, threadId));
      if (scope === 'workflow' && workflowId)
        conditions.push(eq(memories.workflowId, workflowId));
      if (scope === 'session' && workflowId && sessionKey) {
        conditions.push(eq(memories.workflowId, workflowId));
        conditions.push(eq(memories.sessionKey, sessionKey));
      }
      await this.db.delete(memories).where(and(...conditions));
    } catch (err) {
      this.logger.warn(`clearEntries failed for scope "${scope}": ${err}`);
    }
  }

  /**
   * Read keyed entries for retrieve mode (keyword match on content).
   */
  async readEntries(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    scope: 'thread' | 'session' | 'workflow',
    sessionKey: string | undefined,
    query: string,
    topK: number,
  ): Promise<Array<{ key: string; value: unknown }>> {
    try {
      const matchConditions = [
        eq(memories.workspaceId, workspaceId),
        eq(memories.scope, scope),
      ];
      if (scope === 'thread')
        matchConditions.push(eq(memories.threadId, threadId));
      if (scope === 'workflow' && workflowId)
        matchConditions.push(eq(memories.workflowId, workflowId));
      if (scope === 'session' && workflowId && sessionKey) {
        matchConditions.push(eq(memories.workflowId, workflowId));
        matchConditions.push(eq(memories.sessionKey, sessionKey));
      }

      const rows = await this.db
        .select({ content: memories.content, metadata: memories.metadata })
        .from(memories)
        .where(and(...matchConditions))
        .orderBy(sql`${memories.updatedAt} DESC`)
        .limit(topK * 4);

      const q = query.toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.content.toLowerCase().includes(q) ||
              JSON.stringify(r.metadata).toLowerCase().includes(q),
          )
        : rows;

      return filtered.slice(0, topK).map((r) => ({
        key: String(
          (r.metadata as Record<string, unknown> | null)?.memoryKey ??
            r.content.split(':')[0] ??
            '',
        ),
        value:
          (r.metadata as Record<string, unknown> | null)?.value ?? r.content,
      }));
    } catch (err) {
      this.logger.warn(`readEntries failed: ${err}`);
      return [];
    }
  }

  async loadSecret(
    workspaceId: string,
    name: string,
  ): Promise<string | undefined> {
    try {
      const [row] = await this.db
        .select({ valueEncrypted: secrets.valueEncrypted })
        .from(secrets)
        .where(
          and(eq(secrets.workspaceId, workspaceId), eq(secrets.name, name)),
        )
        .limit(1);
      if (!row) return undefined;
      return this.decrypt(row.valueEncrypted);
    } catch (err) {
      this.logger.warn(
        `Failed to load secret ${name} in workspace ${workspaceId}: ${err}`,
      );
      return undefined;
    }
  }

  // Tries the OAuth connections table first; falls back to the plain secrets table.
  async resolveIntegrationToken(
    workspaceId: string,
    provider: string,
    secretName: string,
  ): Promise<string | undefined> {
    try {
      const [row] = await this.db
        .select({
          accessTokenEncrypted: oauthConnections.accessTokenEncrypted,
          expiresAt: oauthConnections.expiresAt,
        })
        .from(oauthConnections)
        .where(
          and(
            eq(oauthConnections.workspaceId, workspaceId),
            eq(oauthConnections.provider, provider),
          ),
        )
        .limit(1);

      if (row) {
        const expired = row.expiresAt && row.expiresAt < new Date();
        if (!expired) {
          return this.decrypt(row.accessTokenEncrypted);
        }
      }
    } catch (err) {
      this.logger.warn(`OAuth lookup failed for ${provider}: ${err}`);
    }

    // Fall back to manually stored secret
    return this.loadSecret(workspaceId, secretName);
  }

  async loadMcpServer(
    workspaceId: string,
    mcpServerId: string,
  ): Promise<{ url: string; accessToken?: string } | undefined> {
    try {
      const [row] = await this.db
        .select({
          url: mcpServers.url,
          accessTokenEncrypted: mcpServers.accessTokenEncrypted,
        })
        .from(mcpServers)
        .where(
          and(
            eq(mcpServers.workspaceId, workspaceId),
            eq(mcpServers.id, mcpServerId),
          ),
        )
        .limit(1);

      if (!row) return undefined;
      return {
        url: row.url,
        accessToken: row.accessTokenEncrypted
          ? this.decrypt(row.accessTokenEncrypted)
          : undefined,
      };
    } catch (err) {
      this.logger.warn(`Failed to load MCP server ${mcpServerId}: ${err}`);
      return undefined;
    }
  }

  async storeLongTermMemory(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
    key: string,
    value: string,
    aiService: AIService,
  ): Promise<void> {
    const content = `${key}: ${value}`;
    // Shared with the fact-extraction ingest writer to keep both in the same embedding space
    const embedding = await aiService.embedForMemory(content);

    // Upsert: delete existing entry for this key+scope, then insert fresh
    await this.db
      .delete(memories)
      .where(
        and(
          eq(memories.workspaceId, workspaceId),
          eq(memories.scope, 'workflow'),
          ...(workflowId ? [eq(memories.workflowId, workflowId)] : []),
          sql`${memories.metadata}->>'key' = ${key}`,
        ),
      );

    await this.db.insert(memories).values({
      workspaceId,
      workflowId: workflowId ?? null,
      threadId,
      scope: 'workflow',
      source: 'extracted',
      content,
      embedding,
      metadata: { key, value },
    });
  }

  async searchSemantic(
    workspaceId: string,
    workflowId: string | undefined,
    query: string,
    topK: number,
    aiService: AIService,
    threadId?: string,
  ): Promise<Array<{ key: string; value: unknown; score: number }>> {
    // Must match storeLongTermMemory's embedding call to stay in the same vector space
    const queryEmbedding = await aiService.embedForMemory(query);
    const embeddingLiteral = `[${queryEmbedding.join(',')}]`;
    const rows = await this.db.execute(sql`
      SELECT metadata, 1 - (embedding <=> ${embeddingLiteral}::vector) AS score
      FROM memories
      WHERE workspace_id = ${workspaceId}
        ${workflowId ? sql`AND workflow_id = ${workflowId}` : sql``}
        ${threadId ? sql`AND thread_id = ${threadId}` : sql``}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingLiteral}::vector
      LIMIT ${topK}
    `);

    return Array.from(rows).map((r: any) => ({
      key: String(r.metadata?.key ?? ''),
      value: r.metadata?.value,
      score: Number(r.score),
    }));
  }

  async loadRecentForContext(
    workspaceId: string,
    workflowId: string | undefined,
    topK: number,
    threadId?: string,
  ): Promise<Array<{ key: string; value: unknown }>> {
    try {
      const filter = and(
        eq(memories.workspaceId, workspaceId),
        ...(workflowId ? [eq(memories.workflowId, workflowId)] : []),
        // Scope to the current thread to prevent cross-user memory leakage
        ...(threadId ? [eq(memories.threadId, threadId)] : []),
      );
      const rows = await this.db
        .select({ metadata: memories.metadata, content: memories.content })
        .from(memories)
        .where(filter)
        .orderBy(sql`${memories.updatedAt} DESC`)
        .limit(topK);

      return rows.map((r) => ({
        key: String(
          (r.metadata as Record<string, unknown> | null)?.key ??
            r.content.split(':')[0] ??
            '',
        ),
        value: r.metadata?.value ?? r.content,
      }));
    } catch (err) {
      this.logger.warn(`loadRecentForContext failed: ${err}`);
      return [];
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private decrypt(ciphertext: string): string {
    const buf = Buffer.from(ciphertext, 'base64');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }
}
