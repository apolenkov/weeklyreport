import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/nestjs";

const HTTP_SERVER_ERROR_THRESHOLD = 500;

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (
      !(exception instanceof HttpException) ||
      exception.getStatus() >= HTTP_SERVER_ERROR_THRESHOLD
    ) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
