import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service.js';
import { ApiKeysController } from './api-keys.controller.js';
import { RoleGuard } from '../common/guards/role.guard.js';

@Module({
  providers: [ApiKeysService, RoleGuard],
  controllers: [ApiKeysController],
})
export class ApiKeysModule {}
