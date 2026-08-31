import * as Sentry from "@sentry/nestjs";

import type { AppLogger } from "../lib/logger.js";

const DEFAULT_FATAL_SHUTDOWN_DEADLINE_MS = 5000;

class FatalShutdownTimeout extends Error {
  constructor() {
    super("fatal shutdown deadline exceeded");
  }
}

export interface ProcessErrorHandlerOptions {
  readonly shutdown?: () => Promise<void>;
  readonly exit?: (code: number) => never;
  readonly deadlineMs?: number;
}

const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

const drainWithDeadline = async (
  shutdown: () => Promise<void>,
  deadlineMs: number,
): Promise<void> => {
  await Promise.race([
    shutdown(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new FatalShutdownTimeout()), deadlineMs);
    }),
  ]);
};

export function registerProcessErrorHandlers(
  logger: AppLogger,
  options: ProcessErrorHandlerOptions = {},
): void {
  const shutdown = options.shutdown ?? (() => Promise.resolve());
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const deadlineMs = options.deadlineMs ?? DEFAULT_FATAL_SHUTDOWN_DEADLINE_MS;
  const state = { fatalShutdownStarted: false };

  const handleFatal = (kind: string, value: unknown): void => {
    if (state.fatalShutdownStarted) return;
    state.fatalShutdownStarted = true;
    const error = asError(value);
    try {
      logger.error(kind, {
        ...(kind === "uncaught exception"
          ? { name: error.name, message: error.message, stack: error.stack }
          : {
              reason: {
                name: error.name,
                message: error.message,
                stack: error.stack,
              },
            }),
      });
    } catch (loggingError: unknown) {
      process.stderr.write(
        `[fatal] failed to write ${kind}: ${asError(loggingError).message}\n`,
      );
    }
    try {
      Sentry.captureException(error);
    } catch (captureError: unknown) {
      process.stderr.write(
        `[fatal] failed to capture ${kind}: ${asError(captureError).message}\n`,
      );
    }

    void (async () => {
      try {
        await drainWithDeadline(shutdown, deadlineMs);
      } catch (shutdownError: unknown) {
        const message =
          shutdownError instanceof FatalShutdownTimeout
            ? "shutdown timed out"
            : `shutdown failed: ${asError(shutdownError).message}`;
        process.stderr.write(`[fatal] ${message}\n`);
      }
      try {
        exit(1);
      } catch {
        // Test doubles may throw to emulate process.exit; production exit does
        // not return. Swallowing prevents a recursive unhandled rejection.
      }
    })();
  };

  process.on("uncaughtException", (error) =>
    handleFatal("uncaught exception", error),
  );
  process.on("unhandledRejection", (reason) =>
    handleFatal("unhandled rejection", reason),
  );
}
