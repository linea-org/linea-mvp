import { Module } from '@nestjs/common';
import { PodsService } from './pods.service';
import { PodsController } from './pods.controller';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';

@Module({
  providers: [PodsService, PodGuard, RoleGuard],
  controllers: [PodsController],
  exports: [PodsService, PodGuard, RoleGuard],
})
export class PodsModule {}
