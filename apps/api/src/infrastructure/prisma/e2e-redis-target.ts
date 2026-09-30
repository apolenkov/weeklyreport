// Redis half of the E2E target contract: loopback endpoint and reserved DB 15.
// Shared by E2E setup and the guarded Redis cleanup; the PostgreSQL half lives
// in e2e-destructive-target.ts, which prisma/guards/_destructive-guard.ts
// re-exports together with this module.
import {
  E2E_DATABASE_NAME,
  isLoopbackHost,
  MAX_TCP_PORT,
} from "./e2e-destructive-target.js";

export const E2E_REDIS_DB = "15" as const;

export interface E2eRedisTarget {
  readonly host: string;
  readonly port: number;
  readonly db: typeof E2E_REDIS_DB;
}

/**
 * Validate the loopback Redis endpoint and the reserved logical DB 15 from the
 * environment. One check shared by E2E setup and the guarded Redis cleanup.
 */
export function parseE2eRuntimeRedisTarget(
  scriptName: string,
  env: {
    readonly REDIS_DB?: string;
    readonly REDIS_HOST?: string;
    readonly REDIS_PORT?: string;
  } = process.env,
): E2eRedisTarget {
  if (env.REDIS_DB !== E2E_REDIS_DB) {
    throw new Error(
      `[${scriptName}] REDIS_DB must be exactly ${E2E_REDIS_DB}.`,
    );
  }
  const host = env.REDIS_HOST;
  if (!host) throw new Error(`[${scriptName}] REDIS_HOST must be set.`);
  if (!isLoopbackHost(host)) {
    throw new Error(
      `[${scriptName}] REDIS_HOST must be a loopback address: ${host}`,
    );
  }
  const rawPort = env.REDIS_PORT;
  if (!rawPort) throw new Error(`[${scriptName}] REDIS_PORT must be set.`);
  const port = Number(rawPort);
  if (!/^[1-9]\d*$/u.test(rawPort) || port > MAX_TCP_PORT) {
    throw new Error(
      `[${scriptName}] REDIS_PORT must be a decimal TCP port: ${rawPort}`,
    );
  }
  return { host, port, db: E2E_REDIS_DB };
}

/**
 * Assert that the running application reports the disposable database and the
 * reserved Redis DB. `observed` comes from the app itself, not from setup env.
 */
export function assertObservedRuntimeTarget(
  scriptName: string,
  observed: { readonly database: string; readonly redisDb: number },
): void {
  if (observed.database !== E2E_DATABASE_NAME) {
    throw new Error(
      `[${scriptName}] The running app uses database "${observed.database}", ` +
        `not ${E2E_DATABASE_NAME}. Restart it with the E2E environment.`,
    );
  }
  if (String(observed.redisDb) !== E2E_REDIS_DB) {
    throw new Error(
      `[${scriptName}] The running app uses Redis DB ${observed.redisDb}, ` +
        `not Redis DB ${E2E_REDIS_DB}. Restart it with REDIS_DB=${E2E_REDIS_DB}.`,
    );
  }
}
