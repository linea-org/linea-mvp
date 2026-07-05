import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConnectionsService } from './connections.service.js';
import { CreateConnectionDto } from './dto/create-connection.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { PROVIDERS, type ProviderType } from '../common/utils/config-types.js';

@ApiTags('Connections')
@ApiBearerAuth()
@RequireRole('admin')
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/connections')
export class ConnectionsController {
  constructor(private readonly service: ConnectionsService) {}

  @Post(':provider')
  @ApiOperation({ summary: 'Connect New Provider' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'provider', enum: PROVIDERS })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('provider') provider: ProviderType,
    @Body() dto: CreateConnectionDto,
  ) {
    if (!PROVIDERS.includes(provider)) {
      throw new BadRequestException(`Invalid provider: ${provider}`);
    }
    return this.service.create(workspaceId, provider, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List providers connected and enabled' })
  @ApiParam({ name: 'workspaceId' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a provider (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.delete(workspaceId, id);
  }
}
