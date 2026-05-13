import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { DrizzleDB } from '@linea/db';
import { secrets } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateSecretDto } from './dto/create-secret.dto';

@Injectable()
export class SecretsService {
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

  async create(workspaceId: string, dto: CreateSecretDto) {
    const existing = await this.db
      .select({ id: secrets.id })
      .from(secrets)
      .where(and(eq(secrets.workspaceId, workspaceId), eq(secrets.name, dto.name)))
      .limit(1);

    if (existing.length) {
      throw new ConflictException(`Secret '${dto.name}' already exists. Delete it first to replace it.`);
    }

    const valueEncrypted = this.encrypt(dto.value);
    const [record] = await this.db
      .insert(secrets)
      .values({ workspaceId, name: dto.name, valueEncrypted })
      .returning({ id: secrets.id, name: secrets.name, createdAt: secrets.createdAt });

    return record;
  }

  async findAll(workspaceId: string) {
    return this.db
      .select({ id: secrets.id, name: secrets.name, createdAt: secrets.createdAt })
      .from(secrets)
      .where(eq(secrets.workspaceId, workspaceId));
  }

  async delete(workspaceId: string, id: string) {
    const [row] = await this.db
      .select({ id: secrets.id })
      .from(secrets)
      .where(and(eq(secrets.id, id), eq(secrets.workspaceId, workspaceId)))
      .limit(1);

    if (!row) throw new NotFoundException(`Secret ${id} not found`);
    await this.db.delete(secrets).where(eq(secrets.id, id));
  }

  // Used by the workflow executor to resolve {{secrets.NAME}} references
  async resolve(workspaceId: string, name: string): Promise<string | undefined> {
    const [row] = await this.db
      .select({ valueEncrypted: secrets.valueEncrypted })
      .from(secrets)
      .where(and(eq(secrets.workspaceId, workspaceId), eq(secrets.name, name)))
      .limit(1);

    if (!row) return undefined;
    return this.decrypt(row.valueEncrypted);
  }

  private encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
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
