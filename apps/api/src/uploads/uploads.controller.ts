import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { PresignDto } from './dto/presign.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId/uploads')
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Post('presign')
  presign(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: PresignDto,
  ) {
    return this.service.presign(workspaceId, user.id, dto.filename, dto.contentType, dto.size);
  }
}
