import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { OAuthService } from './oauth.service';

// Authenticated routes — list connections, revoke, initiate OAuth flow
@Controller('workspaces/:workspaceId/oauth')
@UseGuards(WorkspaceGuard)
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('connections')
  listConnections(@Param('workspaceId') workspaceId: string) {
    return this.oauth.listConnections(workspaceId);
  }

  @Delete('connections/:id')
  async revoke(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.oauth.revokeConnection(workspaceId, id);
    return { success: true };
  }

  // Returns the OAuth provider URL so the frontend can redirect to it.
  // Gated by WorkspaceGuard so only members of workspaceId can initiate a flow.
  @Get(':provider/connect-url')
  getConnectUrl(
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: string,
  ) {
    const apiUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:3001';
    const redirectUri = `${apiUrl}/oauth/${provider}/callback`;
    const url = this.oauth.buildAuthUrl(provider, workspaceId, redirectUri);
    return { url };
  }
}

// Public routes — OAuth provider callbacks only (no Clerk token in browser redirect)
@Controller('oauth')
export class OAuthCallbackController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  // Removed — use GET /workspaces/:workspaceId/oauth/:provider/connect-url instead
  @Public()
  @Get(':provider/connect')
  connectGone() {
    throw new GoneException(
      'Use GET /workspaces/:workspaceId/oauth/:provider/connect-url',
    );
  }

  // OAuth provider redirects here after user approves
  @Public()
  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const webUrl =
      this.config.get<string>('WEB_URL') ?? 'http://localhost:3001';

    if (error) {
      return res.redirect(
        `${webUrl}/settings/connections?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      throw new BadRequestException(
        'Missing code or state from OAuth provider',
      );
    }

    const redirectUri = this.buildRedirectUri(provider);
    await this.oauth.handleCallback(provider, code, state, redirectUri);

    res.redirect(`${webUrl}/settings/connections?connected=${provider}`);
  }

  private buildRedirectUri(provider: string): string {
    const apiUrl =
      this.config.get<string>('API_URL') ?? 'http://localhost:3000';
    return `${apiUrl}/oauth/${provider}/callback`;
  }
}
