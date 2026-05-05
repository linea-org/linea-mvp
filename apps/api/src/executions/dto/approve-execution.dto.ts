import { IsBoolean, IsOptional, IsString, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Used for:
 *   - approval node (approved/denied)
 *   - tool_approval interrupt (approved/denied)
 *   - ask_human interrupt (answer)
 */
export class ApproveExecutionDto {
  @ApiPropertyOptional({
    description:
      'Whether the action is approved (for approval/tool_approval interrupts)',
  })
  @IsBoolean()
  @IsOptional()
  approved?: boolean;

  @ApiPropertyOptional({
    description: 'Human answer (for ask_human interrupts)',
  })
  @IsString()
  @IsOptional()
  answer?: string;

  @ApiPropertyOptional({ description: 'Optional comment or reason' })
  @IsString()
  @IsOptional()
  comment?: string;
}
