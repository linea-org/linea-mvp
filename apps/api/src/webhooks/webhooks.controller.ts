import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { SpaceGuard } from '../common/guards/space.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, SpaceGuard)
@Controller('workspaces/:workspaceId/spaces/:spaceId/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a webhook trigger for a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  create(
    @Param('spaceId') spaceId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.service.create(spaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  findAll(@Param('spaceId') spaceId: string) {
    return this.service.findAll(spaceId);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  delete(@Param('spaceId') spaceId: string, @Param('id') id: string) {
    return this.service.delete(spaceId, id);
  }
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookTriggerController {
  constructor(private readonly service: WebhooksService) {}

  @Post(':id/trigger')
  @Public()
  @ApiOperation({ summary: 'Trigger a workflow via webhook (public, requires x-webhook-secret)' })
  @ApiParam({ name: 'id' })
  @ApiHeader({ name: 'x-webhook-secret', required: true })
  trigger(
    @Param('id') id: string,
    @Headers('x-webhook-secret') secret: string,
    @Body() body: Record<string, unknown>,
  ) {
    if (!secret) throw new UnauthorizedException('Missing x-webhook-secret header');
    return this.service.trigger(id, secret, body);
  }
}
