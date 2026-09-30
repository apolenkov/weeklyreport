import { isIP } from "node:net";

import {
  assertE2eRuntimeDestructive,
  E2E_DESTRUCTIVE_CONSENT,
  parseE2eRuntimeDatabaseTarget,
  sameLocalPostgresDatabaseTarget,
} from "../../prisma/guards/_destructive-guard.js";

export interface E2eRuntimeTarget {
  readonly databaseUrl: string;
  readonly e2eDatabaseUrl: string;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly redisDb: "15";
  readonly consentToken: string;
}

const E2E_DATABASE_NAME = "customreport_e2e";
const E2E_REDIS_DB = "15";
const MAX_TCP_PORT = 65_535;

const IPV4_KIND = 4;
const IPV6_KIND = 6;

function isLoopbackHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === "localhost" || lower === "::1") return true;
  const ipKind = isIP(host);
  if (ipKind === IPV4_KIND) return lower.startsWith("127.");
  if (ipKind === IPV6_KIND) return lower === "::1";
  return false;
}

function validateRedis(
  scriptName: string,
  env: NodeJS.ProcessEnv,
): { host: string; port: number } {
  if (env.REDIS_DB !== E2E_REDIS_DB) {
    throw new Error(
      `[${scriptName}] REDIS_DB must be exactly ${E2E_REDIS_DB}.`,
    );
  }
  const host = env.REDIS_HOST;
  if (!host) {
    throw new Error(`[${scriptName}] REDIS_HOST must be set.`);
  }
  if (!isLoopbackHost(host)) {
    throw new Error(
      `[${scriptName}] REDIS_HOST must be a loopback address: ${host}`,
    );
  }
  const rawPort = env.REDIS_PORT;
  if (!rawPort) {
    throw new Error(`[${scriptName}] REDIS_PORT must be set.`);
  }
  const port = Number(rawPort);
  if (
    !/^[1-9]\d*$/u.test(rawPort) ||
    !Number.isInteger(port) ||
    port > MAX_TCP_PORT
  ) {
    throw new Error(
      `[${scriptName}] REDIS_PORT must be a decimal TCP port: ${rawPort}`,
    );
  }
  return { host, port };
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
  const redis = validateRedis(scriptName, env);

  return {
    databaseUrl,
    e2eDatabaseUrl,
    redisHost: redis.host,
    redisPort: redis.port,
    redisDb: E2E_REDIS_DB,
    consentToken: E2E_DESTRUCTIVE_CONSENT,
  };
}
