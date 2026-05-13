import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { DrizzleDB } from '@linea/db';
import { mcpServers } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateMcpServerDto } from './dto/create-mcp-server.dto';
import type { UpdateMcpServerDto } from './dto/update-mcp-server.dto';

type McpServerSafeResponse = Omit<typeof mcpServers.$inferSelect, 'accessTokenEncrypted'> & {
  hasToken: boolean;
};

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
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
    if (keySource.length === 64 && /^[0-9a-fA-F]+$/.test(keySource)) {
      this.encryptionKey = Buffer.from(keySource, 'hex');
    } else {
      this.encryptionKey = Buffer.alloc(32);
      Buffer.from(keySource, 'utf8').copy(this.encryptionKey);
    }
  }

  // ─── Encryption helpers (AES-256-GCM) ────────────────────────────────────

  private encrypt(plaintext: string): string {
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

  // ─── Safe response helper ─────────────────────────────────────────────────

  private toSafeResponse(
    row: typeof mcpServers.$inferSelect,
  ): McpServerSafeResponse {
    const { accessTokenEncrypted, ...rest } = row;
    return { ...rest, hasToken: accessTokenEncrypted !== null };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    workspaceId: string,
    dto: CreateMcpServerDto,
  ): Promise<McpServerSafeResponse> {
    const [server] = await this.db
      .insert(mcpServers)
      .values({
        workspaceId,
        name: dto.name,
        url: dto.url,
        authType: dto.authType ?? 'none',
        accessTokenEncrypted:
          dto.accessToken ? this.encrypt(dto.accessToken) : null,
      })
      .returning();

    return this.toSafeResponse(server);
  }

  async findAll(workspaceId: string): Promise<McpServerSafeResponse[]> {
    const rows = await this.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.workspaceId, workspaceId));

    return rows.map((r) => this.toSafeResponse(r));
  }

  async findOne(workspaceId: string, id: string): Promise<McpServerSafeResponse> {
    const [row] = await this.db
      .select()
      .from(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.workspaceId, workspaceId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`MCP server ${id} not found`);
    }

    return this.toSafeResponse(row);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateMcpServerDto,
  ): Promise<McpServerSafeResponse> {
    // Verify ownership first
    await this.findOne(workspaceId, id);

    const updateValues: Partial<typeof mcpServers.$inferInsert> = {};

    if (dto.name !== undefined) updateValues.name = dto.name;
    if (dto.url !== undefined) updateValues.url = dto.url;
    if (dto.authType !== undefined) updateValues.authType = dto.authType;
    if (dto.accessToken !== undefined) {
      updateValues.accessTokenEncrypted = dto.accessToken
        ? this.encrypt(dto.accessToken)
        : null;
    }

    const [updated] = await this.db
      .update(mcpServers)
      .set(updateValues)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.workspaceId, workspaceId)))
      .returning();

    return this.toSafeResponse(updated);
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    // Verify ownership first
    await this.findOne(workspaceId, id);

    await this.db
      .delete(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.workspaceId, workspaceId)));
  }
}
