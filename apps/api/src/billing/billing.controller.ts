import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { BillingService } from './billing.service.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

class CreateCheckoutDto {
  plan!: string;
}

@ApiTags('Billing')
@Controller('workspaces/:workspaceId/billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('plans')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard, RoleGuard)
  @ApiOperation({
    summary: 'Get available plans and current plan for workspace',
  })
  @ApiParam({ name: 'workspaceId' })
  getPlans(@Param('workspaceId') workspaceId: string) {
    return this.service.getPlans(workspaceId);
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(WorkspaceGuard, RoleGuard)
  @RequireRole('admin')
  @ApiOperation({
    summary: 'Create a Polar.sh checkout session for plan upgrade',
  })
  @ApiParam({ name: 'workspaceId' })
  createCheckout(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.service.createCheckout(workspaceId, dto.plan);
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Polar.sh webhook handler' })
  @ApiParam({ name: 'workspaceId' })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-polar-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    return this.service.handleWebhook(rawBody, signature);
  }
}
