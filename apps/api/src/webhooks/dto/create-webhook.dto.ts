import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty()
  @IsUUID()
  workflowId!: string;
}
