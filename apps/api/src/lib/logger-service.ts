import { type AppLogger, createAppLogger, logLevelSchema } from "./logger.js";

/**
 * The single logger-init block for services whose `logger` field initializes
 * before Nest resolves the DI container (they are also `new`-ed directly in
 * tests). `LOG_LEVEL` is parsed through the env schema's own validator, so a
 * missing or invalid value fails loud here instead of a silent "info" fallback
 * masking a misconfigured deploy.
 */
export function createServiceLogger(service: string): AppLogger {
  return createAppLogger({
    service,
    minLevel: logLevelSchema.parse(process.env.LOG_LEVEL),
    logDir: process.env.LOG_DIR,
  });
}
