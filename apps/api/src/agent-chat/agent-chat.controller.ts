import { Controller, Post, Param, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { AgentChatService } from './agent-chat.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('Agent Chat')
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
}
