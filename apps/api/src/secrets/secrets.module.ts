import { Module } from '@nestjs/common';
import { SecretsService } from './secrets.service';
import { SecretsController } from './secrets.controller';
import { RoleGuard } from '../common/guards/role.guard';

@Module({
  providers: [SecretsService, RoleGuard],
  controllers: [SecretsController],
  exports: [SecretsService],
})
export class SecretsModule {}
