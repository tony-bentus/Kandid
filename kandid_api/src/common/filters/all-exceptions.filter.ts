import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const path = request.originalUrl || request.url;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let error = status >= 500 ? 'Internal Server Error' : 'Request Error';
    let message: string | string[] = 'Unexpected error';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name.replace(/Exception$/, '');
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        const body = exceptionResponse as {
          error?: string;
          message?: string | string[];
        };

        message = body.message ?? exception.message;
        error = body.error ?? error;
      }
    }

    // Never expose internal details (SQL, hosts, paths) on server errors.
    if (status >= 500) {
      message = 'Unexpected error';
      error = 'Internal Server Error';
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${path} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      path,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }
}
