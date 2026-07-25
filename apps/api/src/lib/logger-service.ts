import { type AppLogger, createAppLogger, logLevelSchema } from "./logger.js";

// Pre-DI init for services new-ed in tests. LOG_LEVEL via schema — no silent
// "info" fallback that would mask a misconfigured deploy.
/**
 * Create Service Logger.
 * @param service - The service argument.
 */
export function createServiceLogger(service: string): AppLogger {
  return createAppLogger({
    service,
    minLevel: logLevelSchema.parse(process.env.LOG_LEVEL),
    logDir: process.env.LOG_DIR,
  });
}
