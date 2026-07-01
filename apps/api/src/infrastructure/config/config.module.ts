import { Module } from "@nestjs/common";

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
 */
@Module({
  providers: [{ provide: ENV_CONFIG, useFactory: validateEnv }],
  exports: [ENV_CONFIG],
})
export class ConfigModule {}
