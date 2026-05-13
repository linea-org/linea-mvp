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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a webhook trigger for a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  create(
    @Param('podId') podId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.service.create(podId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List webhooks' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findAll(@Param('podId') podId: string) {
    return this.service.findAll(podId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Delete a webhook (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  delete(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.delete(podId, id);
  }
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookTriggerController {
  constructor(private readonly service: WebhooksService) {}

  @Post(':id/trigger')
  @Public()
  @ApiOperation({ summary: 'Trigger a workflow via webhook (public, requires x-linea-signature + x-webhook-timestamp)' })
  @ApiParam({ name: 'id' })
  @ApiHeader({ name: 'x-linea-signature', required: true, description: 'HMAC-SHA256 signature: sha256=<hex>' })
  @ApiHeader({ name: 'x-webhook-timestamp', required: true, description: 'Unix timestamp in seconds (request must be within 5 minutes of server time)' })
  trigger(
    @Param('id') id: string,
    @Headers('x-linea-signature') signature: string,
    @Headers('x-webhook-timestamp') timestamp: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
  ) {
    if (!signature) throw new UnauthorizedException('Missing x-linea-signature header');
    if (!timestamp) throw new UnauthorizedException('Missing x-webhook-timestamp header');
    if (!req.rawBody) throw new UnauthorizedException('Raw body unavailable — cannot verify signature');
    return this.service.trigger(id, signature, timestamp, req.rawBody, body);
  }
}
