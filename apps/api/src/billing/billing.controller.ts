import {
  Controller, Get, Post, Body, Param, Headers,
  UseGuards, HttpCode, RawBodyRequest, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

class CreateOrderDto {
  plan!: string;
}

class VerifyPaymentDto {
  orderId!: string;
  paymentId!: string;
  signature!: string;
  plan!: string;
}

@ApiTags('Billing')
@Controller('workspaces/:workspaceId/billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get available plans and Razorpay key' })
  @ApiParam({ name: 'workspaceId' })
  getPlans(@Param('workspaceId') workspaceId: string) {
    return this.service.getPlans(workspaceId);
  }

  @Post('order')
  @ApiBearerAuth()
  @UseGuards(ClerkAuthGuard, WorkspaceGuard, RoleGuard)
  @RequireRole('admin')
  @ApiOperation({ summary: 'Create a Razorpay order for plan upgrade' })
  @ApiParam({ name: 'workspaceId' })
  createOrder(@Param('workspaceId') workspaceId: string, @Body() dto: CreateOrderDto) {
    return this.service.createOrder(workspaceId, dto.plan);
  }

  @Post('verify')
  @ApiBearerAuth()
  @UseGuards(ClerkAuthGuard, WorkspaceGuard, RoleGuard)
  @RequireRole('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify payment and upgrade plan' })
  @ApiParam({ name: 'workspaceId' })
  verifyPayment(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.service.verifyPayment(
      workspaceId,
      dto.orderId,
      dto.paymentId,
      dto.signature,
      dto.plan,
    );
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Razorpay webhook handler' })
  @ApiParam({ name: 'workspaceId' })
  webhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    return this.service.handleWebhook(payload, signature);
  }
}
