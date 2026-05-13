import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsUUID,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CronExpressionParser } from 'cron-parser';

function IsSafeCronExpression(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeCronExpression',
      target: (object as any).constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const fields = value.trim().split(/\s+/);
          // Reject 6-field (seconds-precision) crons
          if (fields.length !== 5) return false;
          try {
            const parsed = CronExpressionParser.parse(value);
            // Enforce minimum 1-minute interval by checking two consecutive fires
            const first = parsed.next().toDate().getTime();
            const second = parsed.next().toDate().getTime();
            if (second - first < 60_000) return false;
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(_args: ValidationArguments) {
          return 'cronExpr must be a valid 5-field cron expression with a minimum interval of 1 minute (e.g. "0 * * * *")';
        },
      },
    });
  };
}

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  workflowId!: string;

  @ApiProperty({ example: '0 * * * *', description: '5-field cron expression, minimum 1-minute interval' })
  @IsString()
  @IsSafeCronExpression()
  cronExpr!: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
