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

/**
 * Injection token for the validated `EnvConfig`. ONE shared Symbol so every
 * consumer resolves the same provider — a duplicate token would be a silent
 * boot-time DI failure the typechecker cannot catch.
 */
export const ENV_CONFIG = Symbol("ENV_CONFIG");

/**
 * Exposes the validated `EnvConfig` under `ENV_CONFIG` so any importing module
 * can inject it. `validateEnv()` is a pure `safeParse` of `process.env`
 * (idempotent), so running it again in the factory is harmless even though
 * `main.ts` also calls it. The token is exported (not an app.module-only
 * provider) because Nest exports flow up to the importer: an app.module-only
 * provider would be unresolvable from a module that imports this one.
 *
 * `APP_LOGGER` builds the single post-CLS AppLogger from the same options
 * `main.ts` used to build inline (service/minLevel/logDir/clsService) — one
 * shared file sink, resolved by `main.ts` and by `AUDIT_LOGGER` alike, so the
 * audit path adds no second writer. `AUDIT_LOGGER` wraps it via
 * `createAuditLogger`, giving the period schedulers a real audit sink instead
 * of a null-object fallback.
 */
@Module({
  providers: [
    { provide: ENV_CONFIG, useFactory: validateEnv },
    {
      provide: APP_LOGGER,
      useFactory: (env: EnvConfig, cls: ClsService): AppLogger =>
        createAppLogger({
          service: "customreport-api",
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
