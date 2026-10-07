// Redis half of the E2E target contract: loopback endpoint and reserved DB 15.
// Shared by E2E setup and the guarded Redis cleanup; the PostgreSQL half lives
// in e2e-destructive-target.ts, which prisma/guards/_destructive-guard.ts
// re-exports together with this module.
import {
  E2E_DATABASE_NAME,
  MAX_TCP_PORT,
  parseE2eRuntimeDatabaseTarget,
  parseLoopbackHost,
} from "./e2e-destructive-target.js";

export const E2E_REDIS_DB = "15" as const;

export interface E2eRedisTarget {
  readonly host: string;
  readonly port: number;
  readonly db: string;
}

const LANE_DATABASE_PATTERN = /^customreport_e2e_lane_([a-l])_test$/u;
const LANE_FIRST_REDIS_DB = 1;

/**
 * The only logical Redis DB a disposable database may flush: DB 15 for
 * customreport_e2e, DB 1..12 for lanes a..l. DB 0 (product) and DB 13/14 are
 * never reachable; lanes m..o have no Redis DB and are refused.
 */
export function redisDbForDatabase(database: string): string | undefined {
  if (database === E2E_DATABASE_NAME) return E2E_REDIS_DB;
  const lane = LANE_DATABASE_PATTERN.exec(database)?.[1];
  if (lane === undefined) return undefined;
  return String(LANE_FIRST_REDIS_DB + lane.charCodeAt(0) - "a".charCodeAt(0));
}

/**
 * Integration-test guard: the configured Redis DB must be the one assigned to
 * the disposable database that `databaseUrl` names.
 */
export function assertRedisDbMatchesDatabase(
  scriptName: string,
  databaseUrl: string,
  redisDb: number | string,
): void {
  const { database } = parseE2eRuntimeDatabaseTarget(scriptName, databaseUrl);
  const expected = redisDbForDatabase(database);
  if (expected === undefined || String(redisDb) !== expected) {
    throw new Error(
      `[${scriptName}] REDIS_DB must be exactly ${expected ?? "unassigned"} for ${database}.`,
    );
  }
}

/**
 * Validate the loopback Redis endpoint and the reserved logical DB 15 from the
 * environment. One check shared by E2E setup and the guarded Redis cleanup.
 */
export function parseE2eRuntimeRedisTarget(
  scriptName: string,
  env: {
    readonly DATABASE_URL?: string;
    readonly REDIS_DB?: string;
    readonly REDIS_HOST?: string;
    readonly REDIS_PORT?: string;
  } = process.env,
): E2eRedisTarget {
  if (!env.DATABASE_URL) {
    throw new Error(`[${scriptName}] DATABASE_URL must be set.`);
  }
  const { database } = parseE2eRuntimeDatabaseTarget(
    scriptName,
    env.DATABASE_URL,
  );
  const db = redisDbForDatabase(database);
  if (db === undefined) {
    throw new Error(
      `[${scriptName}] Database ${database} has no Redis DB assigned.`,
    );
  }
  if (env.REDIS_DB !== db) {
    throw new Error(
      `[${scriptName}] REDIS_DB must be exactly ${db} for ${database}.`,
    );
  }
  const host = env.REDIS_HOST;
  if (!host) throw new Error(`[${scriptName}] REDIS_HOST must be set.`);
  // Validated loopback literals still need canonicalizing before ioredis:
  // "[::1]" is accepted input but not a dialable DNS name.
  const dialableHost = parseLoopbackHost(host);
  if (dialableHost === null) {
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
  return { host: dialableHost, port, db };
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
