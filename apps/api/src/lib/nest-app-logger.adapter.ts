import type { LoggerService } from "@nestjs/common";

import type { AppLogger } from "./logger.js";

class LoggerSinkOwner {
  constructor(private logger: AppLogger) {}

  readonly current = (): AppLogger => this.logger;

  readonly replace = (logger: AppLogger): void => {
    this.logger = logger;
  };
}

export class NestAppLoggerAdapter implements LoggerService {
  private readonly sink: LoggerSinkOwner;

  constructor(logger: AppLogger) {
    this.sink = new LoggerSinkOwner(logger);
  }

  readonly setLogger = (logger: AppLogger): void => {
    this.sink.replace(logger);
  };

  readonly log = (message: unknown, context?: string): void => {
    this.sink
      .current()
      .info(String(message), context ? { nestContext: context } : undefined);
  };

  readonly error = (
    message: unknown,
    stackOrContext?: string,
    context?: string,
  ): void => {
    this.sink.current().error(String(message), {
      nestContext: context ?? stackOrContext,
      ...(context ? { stack: stackOrContext } : {}),
    });
  };

  readonly warn = (message: unknown, context?: string): void => {
    this.sink
      .current()
      .warn(String(message), context ? { nestContext: context } : undefined);
  };

  readonly debug = (message: unknown, context?: string): void => {
    this.sink
      .current()
      .debug(String(message), context ? { nestContext: context } : undefined);
  };

  readonly verbose = (message: unknown, context?: string): void => {
    this.sink.current().debug(String(message), {
      nestContext: context,
      verbose: true,
    });
  };
}
