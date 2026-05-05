import { Injectable, Inject, Logger } from '@nestjs/common';
import { and, eq, or } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { DrizzleDB } from '@linea/db';
import { memories, apiKeys } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    // Pad/truncate to exactly 32 bytes for AES-256
    const raw =
      this.config.get<string>('ENCRYPTION_KEY') ??
      'default-dev-key-do-not-use-in-prod';
    this.encryptionKey = Buffer.alloc(32);
    Buffer.from(raw, 'utf8').copy(this.encryptionKey);
  }

  // ─── Memory load / save ───────────────────────────────────────────────────

  async loadForExecution(
    workspaceId: string,
    workflowId: string | undefined,
    threadId: string,
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
      ];

      const rows = await this.db
        .select({ content: memories.content, scope: memories.scope })
        .from(memories)
        .where(and(eq(memories.workspaceId, workspaceId), or(...scopeFilters)));

      // Merge all rows — later rows (workflow then thread) take precedence
      const sorted = [
        ...rows.filter((r) => r.scope === 'workflow'),
        ...rows.filter((r) => r.scope === 'thread'),
      ];

      let merged: Record<string, any> = {};
      for (const row of sorted) {
        try {
          const parsed = JSON.parse(row.content);
          if (parsed && typeof parsed === 'object')
            merged = { ...merged, ...parsed };
        } catch {
          // skip unparseable rows
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
      // Delete old thread-scoped entry for this thread, then insert fresh
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

  // ─── Per-workspace API key resolution ────────────────────────────────────

  async loadApiKey(
    workspaceId: string,
    provider: string,
  ): Promise<string | undefined> {
    try {
      const [row] = await this.db
        .select({ keyEncrypted: apiKeys.keyEncrypted })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.workspaceId, workspaceId),
            eq(apiKeys.provider, provider),
          ),
        )
        .limit(1);

      if (!row) return undefined;
      return this.decrypt(row.keyEncrypted);
    } catch (err) {
      this.logger.warn(
        `Failed to load API key for provider ${provider} in workspace ${workspaceId}: ${err}`,
      );
      return undefined;
    }
  }

  // ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────

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
