import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { OAuthService } from './oauth.service';

// Authenticated routes — list connections, revoke
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
}

// Public routes — browser redirects (no Clerk token possible)
@Controller('oauth')
export class OAuthCallbackController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  // Browser navigates here to start the OAuth flow
  @Public()
  @Get(':provider/connect')
  connect(
    @Param('provider') provider: string,
    @Query('workspaceId') workspaceId: string,
    @Res() res: Response,
  ) {
    const redirectUri = this.buildRedirectUri(provider);
    const url = this.oauth.buildAuthUrl(provider, workspaceId, redirectUri);
    res.redirect(url);
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
    const webUrl = this.config.get<string>('WEB_URL') ?? 'http://localhost:3001';

    if (error) {
      return res.redirect(`${webUrl}/settings/connections?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      throw new BadRequestException('Missing code or state from OAuth provider');
    }

    const redirectUri = this.buildRedirectUri(provider);
    await this.oauth.handleCallback(provider, code, state, redirectUri);

    res.redirect(`${webUrl}/settings/connections?connected=${provider}`);
  }

  private buildRedirectUri(provider: string): string {
    const apiUrl = this.config.get<string>('API_URL') ?? 'http://localhost:3000';
    return `${apiUrl}/oauth/${provider}/callback`;
  }
}
