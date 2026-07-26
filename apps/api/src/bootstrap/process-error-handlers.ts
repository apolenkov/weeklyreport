import type { AppLogger } from "../lib/logger";

export function registerProcessErrorHandlers(logger: AppLogger): void {
  process.on("uncaughtException", (err) => {
    logger.error("uncaught exception", {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", {
      reason:
        reason instanceof Error
          ? { name: reason.name, message: reason.message, stack: reason.stack }
          : String(reason),
    });
  });
}
