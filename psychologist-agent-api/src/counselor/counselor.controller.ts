import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CounselorService } from './counselor.service';
import { chatRequestSchema, createSessionSchema } from './dto/counselor.dto';

@Controller('counselor')
export class CounselorController {
  constructor(private readonly counselor: CounselorService) {}

  @Get('runtime')
  runtime() {
    return this.counselor.describeRuntime();
  }

  @Get('sessions')
  listSessions() {
    return this.counselor.listSessions();
  }

  @Post('sessions')
  createSession(@Body() body: unknown) {
    const parsed = createSessionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.counselor.createSession(parsed.data.title);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const session = await this.counselor.getSession(id);
    if (!session) {
      throw new NotFoundException(`会话不存在：${id}`);
    }
    return session;
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    const removed = await this.counselor.deleteSession(id);
    if (!removed) {
      throw new NotFoundException(`会话不存在：${id}`);
    }
    return { id, deleted: true };
  }

  /** Server-Sent Events：前端按 `data: {json}` 逐条解析。 */
  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      response.status(400).json({
        message: '请求参数不合法',
        issues: parsed.error.issues,
      });
      return;
    }

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    const abort = new AbortController();
    request.on('close', () => abort.abort());

    try {
      for await (const event of this.counselor.streamChat(
        parsed.data,
        abort.signal,
      )) {
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        response.write(
          `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`,
        );
      }
    } finally {
      response.end();
    }
  }
}
