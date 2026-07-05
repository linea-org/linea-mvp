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
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { User } from '@linea/db';

@ApiTags('API Keys')
@ApiBearerAuth()
@RequireRole('admin')
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/api-keys')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Linea API key (returned once)' })
  @ApiParam({ name: 'workspaceId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.service.create(workspaceId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys (never returns the key itself)' })
  @ApiParam({ name: 'workspaceId' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  revoke(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.revoke(workspaceId, id);
  }
}
