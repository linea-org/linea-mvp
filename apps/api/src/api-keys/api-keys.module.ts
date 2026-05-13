import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { RoleGuard } from '../common/guards/role.guard';

@Module({
  providers: [ApiKeysService, RoleGuard],
  controllers: [ApiKeysController],
})
export class ApiKeysModule {}
