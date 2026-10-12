import { Module } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import {
  APP_LOGGER,
  AUDIT_LOGGER,
  createAuditLogger,
} from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { createAppLogger } from "../../lib/logger.js";
import type { EnvConfig } from "./env.schema";
import { validateEnv } from "./env.schema";

// One shared Symbol — a duplicate token would silently fail DI at boot.
export const ENV_CONFIG = Symbol("ENV_CONFIG");

// Nested modules inject ENV_CONFIG via this export (app.module-only providers
// are unresolvable from importers). APP_LOGGER is the single shared sink so
// AUDIT_LOGGER does not open a second writer.
@Module({
  providers: [
    { provide: ENV_CONFIG, useFactory: validateEnv },
    {
      provide: APP_LOGGER,
      useFactory: (env: EnvConfig, cls: ClsService): AppLogger =>
        createAppLogger({
          service: "weeklyreport-api",
          minLevel: env.LOG_LEVEL,
          logDir: env.LOG_DIR,
          clsService: cls,
        }),
      inject: [ENV_CONFIG, ClsService],
    },
    {
      provide: AUDIT_LOGGER,
      useFactory: (logger: AppLogger) => createAuditLogger(logger),
      inject: [APP_LOGGER],
    },
  ],
  exports: [ENV_CONFIG, APP_LOGGER, AUDIT_LOGGER],
})
export class ConfigModule {}
