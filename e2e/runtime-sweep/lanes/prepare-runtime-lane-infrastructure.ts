import pg from "pg";

import type { RuntimeLaneResource } from "./contracts/runtime-lane-contract.ts";
import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
} from "./redis/runtime-lane-redis-authorization.ts";
import { prepareRuntimeLaneRedisContainer } from "./redis/runtime-lane-redis-container.ts";
import { runtimeLaneDatabaseUrl } from "./resources/runtime-lane-database-url.ts";

const DATABASE_NAME = /^customreport_e2e_lane_[a-o]_test$/u;

const quoteDatabaseIdentifier = (databaseName: string): string => {
  if (!DATABASE_NAME.test(databaseName))
    throw new Error("Runtime lane database name is not canonical");
  return `"${databaseName}"`;
};

const prepareDatabases = async (
  resources: readonly RuntimeLaneResource[],
  baseDatabaseUrl: string,
): Promise<number> => {
  runtimeLaneDatabaseUrl(baseDatabaseUrl, resources[0]?.databaseName ?? "");
  const client = new pg.Client({ connectionString: baseDatabaseUrl });
  await client.connect();
  try {
    const databaseNames = resources.map(({ databaseName }) => databaseName);
    const existing = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
      [databaseNames],
    );
    const existingNames = new Set(existing.rows.map(({ datname }) => datname));
    const missingNames = databaseNames.filter(
      (databaseName) => !existingNames.has(databaseName),
    );
    await missingNames.reduce<Promise<void>>(async (previous, databaseName) => {
      await previous;
      await client.query(
        `CREATE DATABASE ${quoteDatabaseIdentifier(databaseName)}`,
      );
    }, Promise.resolve());
    return missingNames.length;
  } finally {
    await client.end().catch(() => undefined);
  }
};

export interface RuntimeLaneInfrastructureResult {
  readonly databasesCreated: number;
  readonly redisCreated: number;
  readonly redisStarted: number;
  readonly redisReady: number;
}

interface RuntimeLaneInfrastructureDependencies {
  readonly prepareDatabases: typeof prepareDatabases;
  readonly prepareRedis: typeof prepareRuntimeLaneRedisContainer;
}

const DEFAULT_DEPENDENCIES: RuntimeLaneInfrastructureDependencies = {
  prepareDatabases,
  prepareRedis: prepareRuntimeLaneRedisContainer,
};

export async function prepareRuntimeLaneInfrastructure(
  input: Readonly<{
    readonly resources: readonly RuntimeLaneResource[];
    readonly baseDatabaseUrl: string;
  }>,
  dependencies: RuntimeLaneInfrastructureDependencies = DEFAULT_DEPENDENCIES,
): Promise<RuntimeLaneInfrastructureResult> {
  consumeRuntimeLaneRedisRecreationAuthorization(
    requireRuntimeLaneRedisRecreationAuthorization(),
  );
  if (input.resources.length === 0)
    throw new Error("Runtime lane infrastructure requires at least one lane");
  const databasesCreated = await dependencies.prepareDatabases(
    input.resources,
    input.baseDatabaseUrl,
  );
  const redisStates = await Promise.all(
    input.resources.map((resource) => dependencies.prepareRedis(resource)),
  );
  return {
    databasesCreated,
    redisCreated: redisStates.filter((state) => state === "created").length,
    redisStarted: redisStates.filter((state) => state === "started").length,
    redisReady: redisStates.filter((state) => state === "ready").length,
  };
}
