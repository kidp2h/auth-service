import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DomainException } from '@domain/exceptions/domain.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(
        `RPC Exception caught by filter: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : '',
      );
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';

    // 1. Handle Domain Exceptions
    if (exception instanceof DomainException) {
      httpStatus = exception.statusCode;
      errorCode = exception.errorCode;
      message = exception.message;
    }
    // 2. Handle standard NestJS HTTP Exceptions
    else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      errorCode = this.mapHttpStatusToErrorCode(httpStatus);
      const response = exception.getResponse();
      message =
        typeof response === 'object' &&
        response !== null &&
        'message' in response
          ? Array.isArray((response as any).message)
            ? (response as any).message.join(', ')
            : (response as any).message
          : exception.message;
    }
    // 3. Handle unhandled exceptions (connection errors, database crashes, runtime errors)
    else {
      this.logger.error(
        `Unhandled exception caught by global filter: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : '',
      );
    }

    const responseBody = {
      status: httpStatus,
      error: errorCode,
      message: message,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  private mapHttpStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.INTERNAL_SERVER_ERROR:
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
