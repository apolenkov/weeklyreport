import type { LoggerService } from "@nestjs/common";

import type { AppLogger } from "./logger.js";

export class NestAppLoggerAdapter implements LoggerService {
  constructor(private logger: AppLogger) {}

  setLogger(logger: AppLogger): void {
    this.logger = logger;
  }

  log(message: unknown, context?: string): void {
    this.logger.info(
      String(message),
      context ? { nestContext: context } : undefined,
    );
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.logger.error(String(message), {
      nestContext: context ?? stackOrContext,
      ...(context ? { stack: stackOrContext } : {}),
    });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(
      String(message),
      context ? { nestContext: context } : undefined,
    );
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(
      String(message),
      context ? { nestContext: context } : undefined,
    );
  }

  verbose(message: unknown, context?: string): void {
    this.logger.debug(String(message), {
      nestContext: context,
      verbose: true,
    });
  }
}
