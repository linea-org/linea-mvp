import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let message = 'An unexpected error occurred';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b['message'] as string) ?? message;
        details = b['details'];
      }

      code = HTTP_STATUS_TO_CODE[status] ?? 'http_error';
    } else if (exception instanceof Error) {
      // Log full details server-side; never forward internal error messages to clients
      this.logger.error(exception.message, exception.stack, {
        path: request.url,
        method: request.method,
      });
      // message stays as the generic 'An unexpected error occurred'
    }

    response.status(status).json({
      error: { code, message, ...(details ? { details } : {}) },
    });
  }
}

const HTTP_STATUS_TO_CODE: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation_error',
  429: 'rate_limited',
  500: 'internal_error',
};
