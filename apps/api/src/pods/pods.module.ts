import { Module } from '@nestjs/common';
import { PodsService } from './pods.service.js';
import { PodsController } from './pods.controller.js';
import { PodGuard } from '../common/guards/pod.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  providers: [PodsService, PodGuard, RoleGuard],
  controllers: [PodsController],
  exports: [PodsService, PodGuard, RoleGuard],
})
export class PodsModule {}
