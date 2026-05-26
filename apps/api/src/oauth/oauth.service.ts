import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, createHmac, timingSafeEqual, randomBytes } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { oauthConnections } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { OAUTH_PROVIDERS } from './providers';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly encryptionKey: Buffer;
  private readonly stateSigningKey: Buffer;

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>('ENCRYPTION_KEY');
    if (!raw) throw new Error('ENCRYPTION_KEY is required');
    if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
      this.encryptionKey = Buffer.from(raw, 'hex');
    } else {
      this.encryptionKey = Buffer.alloc(32);
      Buffer.from(raw, 'utf8').copy(this.encryptionKey);
    }
    // Derive a separate signing key for OAuth state HMAC (HKDF-lite via SHA-256)
    this.stateSigningKey = createHmac('sha256', this.encryptionKey)
      .update('oauth-state-signing-key')
      .digest();
  }

  buildAuthUrl(
    provider: string,
    workspaceId: string,
    redirectUri: string,
  ): string {
    const cfg = OAUTH_PROVIDERS[provider];
    if (!cfg) throw new BadRequestException(`Unknown OAuth provider: ${provider}`);

    const clientId = this.config.get<string>(cfg.clientIdEnv);
    if (!clientId) {
      throw new BadRequestException(
        `OAuth provider '${provider}' is not configured (missing ${cfg.clientIdEnv})`,
      );
    }

    const statePayload = JSON.stringify({ workspaceId, provider, nonce: randomBytes(16).toString('hex') });
    const sig = createHmac('sha256', this.stateSigningKey).update(statePayload).digest('hex');
    const state = Buffer.from(JSON.stringify({ p: statePayload, s: sig })).toString('base64url');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      ...(cfg.scopes.length > 0 && { scope: cfg.scopes.join(' ') }),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${cfg.authUrl}?${params.toString()}`;
  }

  async handleCallback(
    provider: string,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<{ workspaceId: string }> {
    const cfg = OAUTH_PROVIDERS[provider];
    if (!cfg) throw new BadRequestException(`Unknown OAuth provider: ${provider}`);

    let workspaceId: string;
    try {
      const outer = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as { p: string; s: string };
      const expectedSig = createHmac('sha256', this.stateSigningKey).update(outer.p).digest('hex');
      const expBuf = Buffer.from(expectedSig, 'hex');
      const sigBuf = Buffer.from(outer.s ?? '', 'hex');
      if (expBuf.length !== sigBuf.length || !timingSafeEqual(expBuf, sigBuf)) {
        throw new Error('signature mismatch');
      }
      const payload = JSON.parse(outer.p) as { workspaceId: string; provider: string; nonce: string };
      workspaceId = payload.workspaceId;
    } catch {
      throw new BadRequestException('Invalid OAuth state parameter');
    }

    const clientId = this.config.get<string>(cfg.clientIdEnv);
    const clientSecret = this.config.get<string>(cfg.clientSecretEnv);

    if (!clientId || !clientSecret) {
      throw new BadRequestException(`OAuth provider '${provider}' is not configured`);
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Token exchange failed for ${provider}: ${text}`);
      throw new BadRequestException(`OAuth token exchange failed for ${provider}`);
    }

    const token = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      authed_user?: { access_token?: string }; // Slack v2
    };

    const accessToken = token.authed_user?.access_token ?? token.access_token;
    if (!accessToken) {
      throw new BadRequestException(`No access token returned from ${provider}`);
    }

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : undefined;

    const existing = await this.db
      .select({ id: oauthConnections.id })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.workspaceId, workspaceId),
          eq(oauthConnections.provider, provider),
        ),
      )
      .limit(1);

    const values = {
      workspaceId,
      provider,
      accessTokenEncrypted: this.encrypt(accessToken),
      refreshTokenEncrypted: token.refresh_token ? this.encrypt(token.refresh_token) : null,
      expiresAt: expiresAt ?? null,
      scope: token.scope ?? null,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await this.db
        .update(oauthConnections)
        .set(values)
        .where(eq(oauthConnections.id, existing[0].id));
    } else {
      await this.db.insert(oauthConnections).values(values);
    }

    return { workspaceId };
  }

  async listConnections(workspaceId: string) {
    const rows = await this.db
      .select({
        id: oauthConnections.id,
        provider: oauthConnections.provider,
        providerEmail: oauthConnections.providerEmail,
        scope: oauthConnections.scope,
        expiresAt: oauthConnections.expiresAt,
        createdAt: oauthConnections.createdAt,
        updatedAt: oauthConnections.updatedAt,
      })
      .from(oauthConnections)
      .where(eq(oauthConnections.workspaceId, workspaceId));

    return rows.map((r) => ({
      ...r,
      expired: r.expiresAt ? r.expiresAt < new Date() : false,
    }));
  }

  async getValidToken(workspaceId: string, provider: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.workspaceId, workspaceId),
          eq(oauthConnections.provider, provider),
        ),
      )
      .limit(1);

    if (!row) return null;

    const isExpired = row.expiresAt && row.expiresAt < new Date();
    if (!isExpired) {
      return this.decrypt(row.accessTokenEncrypted);
    }

    if (!row.refreshTokenEncrypted) return null;

    const refreshed = await this.refreshToken(provider, row.refreshTokenEncrypted, row.id);
    return refreshed;
  }

  async revokeConnection(workspaceId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: oauthConnections.id })
      .from(oauthConnections)
      .where(
        and(
          eq(oauthConnections.id, id),
          eq(oauthConnections.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException(`OAuth connection ${id} not found`);
    await this.db.delete(oauthConnections).where(eq(oauthConnections.id, id));
  }

  private async refreshToken(
    provider: string,
    refreshTokenEncrypted: string,
    connectionId: string,
  ): Promise<string | null> {
    const cfg = OAUTH_PROVIDERS[provider];
    if (!cfg) return null;

    const clientId = this.config.get<string>(cfg.clientIdEnv);
    const clientSecret = this.config.get<string>(cfg.clientSecretEnv);
    if (!clientId || !clientSecret) return null;

    const refreshToken = this.decrypt(refreshTokenEncrypted);
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    try {
      const res = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });

      if (!res.ok) return null;
      const token = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        refresh_token?: string;
      };

      if (!token.access_token) return null;

      const expiresAt = token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : undefined;

      await this.db
        .update(oauthConnections)
        .set({
          accessTokenEncrypted: this.encrypt(token.access_token),
          ...(token.refresh_token && {
            refreshTokenEncrypted: this.encrypt(token.refresh_token),
          }),
          expiresAt: expiresAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(oauthConnections.id, connectionId));

      return token.access_token;
    } catch (err) {
      this.logger.warn(`Token refresh failed for ${provider}: ${err}`);
      return null;
    }
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
