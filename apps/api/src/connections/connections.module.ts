import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service.js';
import { ConnectionsController } from './connections.controller.js';
import { RoleGuard } from '../common/guards/role.guard.js';

@Module({
  providers: [ConnectionsService, RoleGuard],
  controllers: [ConnectionsController],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
