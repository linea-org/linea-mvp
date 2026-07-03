import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Res,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { AgentChatService } from './agent-chat.service';
import { ChatDto } from './dto/chat.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import type { User } from '@linea/db';
import { PatchSessionDto, UpsertSessionDto } from './dto/session.dto';

@ApiTags('Agent Chat')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId/agent')
export class AgentChatController {
  constructor(private readonly service: AgentChatService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Stream a chat response from the AI agent' })
  async chat(
    @Param('workspaceId') workspaceId: string,
    @Body() body: ChatDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const event of this.service.chat(workspaceId, body)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions for this workspace' })
  listSessions(@Param('workspaceId') workspaceId: string) {
    return this.service.listSessions(workspaceId);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create or update a chat session' })
  upsertSession(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: UpsertSessionDto,
  ) {
    return this.service.upsertSession(
      workspaceId,
      user.id,
      dto.threadId,
      dto.title,
      dto.messages,
    );
  }

  @Patch('sessions/:sessionId')
  @ApiOperation({ summary: 'Update session title or messages' })
  patchSession(
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: PatchSessionDto,
  ) {
    return this.service.patchSession(workspaceId, sessionId, dto);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a chat session' })
  deleteSession(
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.service.deleteSession(workspaceId, sessionId);
  }
}
