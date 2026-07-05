import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OAuthService } from './oauth.service.js';
import {
  OAuthController,
  OAuthCallbackController,
} from './oauth.controller.js';

@Module({
  imports: [ConfigModule],
  controllers: [OAuthController, OAuthCallbackController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
