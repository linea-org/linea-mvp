import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SecretsService } from './secrets.service.js';
import { CreateSecretDto } from './dto/create-secret.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';

@ApiTags('Secrets')
@ApiBearerAuth()
@RequireRole('admin')
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/secrets')
export class SecretsController {
  constructor(private readonly service: SecretsService) {}

  @Post()
  @ApiOperation({ summary: 'Store a new secret' })
  @ApiParam({ name: 'workspaceId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateSecretDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List secret names (values are never returned)' })
  @ApiParam({ name: 'workspaceId' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a secret (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.delete(workspaceId, id);
  }
}
