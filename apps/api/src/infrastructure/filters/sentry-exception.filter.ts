import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/nestjs";

const HTTP_SERVER_ERROR_THRESHOLD = 500;

// Anything that is not a Nest HttpException is reported deliberately, even when
// it duck-types a 4xx statusCode: only an HttpException carries an authoritative
// status, so a look-alike is far more likely to be an unhandled failure worth
// seeing in Sentry. BaseExceptionFilter's own duck-typing decides the *response*
// status, not what this filter reports.
function shouldCapture(exception: unknown): boolean {
  return (
    !(exception instanceof HttpException) ||
    exception.getStatus() >= HTTP_SERVER_ERROR_THRESHOLD
  );
}

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (shouldCapture(exception)) {
      try {
        Sentry.captureException(exception);
      } catch {
        // Reporting must never preempt the response the base filter writes.
      }
    }
    super.catch(exception, host);
  }
}
