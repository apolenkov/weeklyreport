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
    // Nest's static shutdown hooks log `error(err, err.stack)`; that second
    // argument is the Error's own stack, not a context.
    const ownStack =
      message instanceof Error && stackOrContext === message.stack;
    this.sink.current().error(String(message), {
      ...(message instanceof Error
        ? { name: message.name, stack: message.stack }
        : {}),
      ...(context === undefined && ownStack
        ? {}
        : { nestContext: context ?? stackOrContext }),
      ...(context && stackOrContext !== undefined
        ? { stack: stackOrContext }
        : {}),
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
