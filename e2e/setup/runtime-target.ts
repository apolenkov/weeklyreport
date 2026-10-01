import {
  assertE2eRuntimeDestructive,
  E2E_DATABASE_NAME,
  E2E_DESTRUCTIVE_CONSENT,
  E2E_REDIS_DB,
  parseE2eRuntimeDatabaseTarget,
  parseE2eRuntimeRedisTarget,
  sameLocalPostgresDatabaseTarget,
} from "../../prisma/guards/_destructive-guard.js";

export interface E2eRuntimeTarget {
  readonly databaseUrl: string;
  readonly e2eDatabaseUrl: string;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly redisDb: typeof E2E_REDIS_DB;
  readonly consentToken: string;
}

/**
 * Validate the explicit runtime environment for an E2E phase.
 * Parsing has no database, Redis, process, or filesystem side effects.
 */
export function validateE2eRuntimeTarget(
  scriptName: string,
  env: NodeJS.ProcessEnv = process.env,
): E2eRuntimeTarget {
  const e2eDatabaseUrl = env.E2E_DATABASE_URL;
  const databaseUrl = env.DATABASE_URL;
  if (!e2eDatabaseUrl) {
    throw new Error(`[${scriptName}] E2E_DATABASE_URL is required.`);
  }
  if (!databaseUrl) {
    throw new Error(`[${scriptName}] DATABASE_URL is required.`);
  }

  const e2eTarget = parseE2eRuntimeDatabaseTarget(scriptName, e2eDatabaseUrl);
  if (e2eTarget.database !== E2E_DATABASE_NAME) {
    throw new Error(
      `[${scriptName}] E2E_DATABASE_URL database must be exactly ${E2E_DATABASE_NAME}; got "${e2eTarget.database}".`,
    );
  }
  if (
    !sameLocalPostgresDatabaseTarget(scriptName, e2eDatabaseUrl, databaseUrl)
  ) {
    throw new Error(
      `[${scriptName}] E2E_DATABASE_URL and DATABASE_URL must resolve to the same database target.`,
    );
  }

  assertE2eRuntimeDestructive(scriptName, env);
  const redis = parseE2eRuntimeRedisTarget(scriptName, env);

  return {
    databaseUrl,
    e2eDatabaseUrl,
    redisHost: redis.host,
    redisPort: redis.port,
    redisDb: redis.db,
    consentToken: E2E_DESTRUCTIVE_CONSENT,
  };
}
