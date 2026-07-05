import { Module } from '@nestjs/common';
import { SecretsService } from './secrets.service.js';
import { SecretsController } from './secrets.controller.js';
import { RoleGuard } from '../common/guards/role.guard.js';

@Module({
  providers: [SecretsService, RoleGuard],
  controllers: [SecretsController],
  exports: [SecretsService],
})
export class SecretsModule {}
