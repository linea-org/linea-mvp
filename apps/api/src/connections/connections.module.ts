import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { RoleGuard } from '../common/guards/role.guard';

@Module({
  providers: [ConnectionsService, RoleGuard],
  controllers: [ConnectionsController],
  exports: [ConnectionsService],
})
export class ConnectionsModule { }
