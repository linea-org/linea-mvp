import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import type { DrizzleDB } from '@linea/db';
import { providerConnections } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateConnectionDto } from './dto/create-connection.dto';
import {
  parseProviderConfig,
  ProviderConfigMap,
  ProviderType,
} from '../common/utils/config-types';
import {
  decryptConfig,
  encryptConfig,
  EncryptionKeys,
} from '../common/utils/encryptor';

@Injectable()
export class ConnectionsService {
  private readonly encryptionKeys: EncryptionKeys;
  private readonly CURRENT_KEY_VERSION = 1;
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.encryptionKeys = {
      1: this.config.getOrThrow<string>('ENCRYPTION_KEY_1'), // Current key (latest) make sure it exists
    };
  }

  async create(
    workspaceId: string,
    provider: ProviderType,
    dto: CreateConnectionDto,
  ) {
    const existing = await this.db
      .select({ id: providerConnections.id })
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.workspaceId, workspaceId),
          eq(providerConnections.provider, provider),
        ),
      )
      .limit(1);

    if (existing.length) {
      throw new ConflictException(
        `Connection '${provider}' already exists. Delete it first to replace it.`,
      );
    }

    const parsedConfig = parseProviderConfig(provider, dto.config);

    const key = this.encryptionKeys[this.CURRENT_KEY_VERSION];

    if (!key) {
      throw new Error('Encryption key not found or invalid version');
    }

    const { encrypted, iv, authTag } = encryptConfig(
      JSON.stringify(parsedConfig),
      key,
    );

    const authType = 'api_key'; // for now API key on (we don't need this for now)

    const [record] = await this.db
      .insert(providerConnections)
      .values({
        workspaceId,
        authType,
        configEncrypted: encrypted,
        provider,
        encryptionAuthTag: authTag,
        encryptionIV: iv,
        encryptionKeyVersion: this.CURRENT_KEY_VERSION,
      })
      .returning({
        id: providerConnections.id,
      });

    return record;
  }

  async findAll(workspaceId: string) {
    return this.db
      .select({
        id: providerConnections.id,
        provider: providerConnections.provider,
        createdAt: providerConnections.createdAt,
        enabled: providerConnections.enabled,
      })
      .from(providerConnections)
      .where(eq(providerConnections.workspaceId, workspaceId));
  }

  async delete(workspaceId: string, id: string) {
    const [row] = await this.db
      .select({ id: providerConnections.id })
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.id, id),
          eq(providerConnections.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException(`Secret ${id} not found`);
    await this.db
      .delete(providerConnections)
      .where(eq(providerConnections.id, id));
  }

  async resolve<T extends ProviderType>(
    workspaceId: string,
    provider: T,
  ): Promise<ProviderConfigMap[T] | null> {
    const [row] = await this.db
      .select({
        encrypted: providerConnections.configEncrypted,
        authTag: providerConnections.encryptionAuthTag,
        iv: providerConnections.encryptionIV,
        keyVersion: providerConnections.encryptionKeyVersion,
      })
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.workspaceId, workspaceId),
          eq(providerConnections.provider, provider),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    const key = this.encryptionKeys[row.keyVersion];

    if (!key) {
      throw new Error(`Encryption key not found for version ${row.keyVersion}`);
    }

    const decryptedConfig = decryptConfig(
      row.encrypted,
      row.iv,
      row.authTag,
      key,
    );

    return parseProviderConfig(provider, decryptedConfig);
  }
}
