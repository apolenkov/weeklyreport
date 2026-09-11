import * as Sentry from "@sentry/nestjs";

import type { AppLogger } from "../lib/logger.js";
import type { ShutdownCoordinator } from "./shutdown-coordinator.js";

const asError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

export function registerProcessErrorHandlers(
  logger: AppLogger,
  coordinator: ShutdownCoordinator,
): void {
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

    coordinator.request("fatal");
  };

  process.on("uncaughtException", (error) =>
    handleFatal("uncaught exception", error),
  );
  process.on("unhandledRejection", (reason) =>
    handleFatal("unhandled rejection", reason),
  );
}
