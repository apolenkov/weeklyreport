import { prepareRuntimeLaneInfrastructure } from "./prepare-runtime-lane-infrastructure.ts";
import {
  MAX_RUNTIME_LANE_COUNT,
  MIN_RUNTIME_LANE_COUNT,
  runtimeLaneResources,
} from "./runtime-lane-contract.ts";
import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime lane infrastructure requires ${name}`);
  return value;
};

const laneCountFrom = (value: string): number => {
  const laneCount = Number(value);
  if (
    !Number.isInteger(laneCount) ||
    laneCount < MIN_RUNTIME_LANE_COUNT ||
    laneCount > MAX_RUNTIME_LANE_COUNT
  )
    throw new Error(
      `RUNTIME_SWEEP_LANE_COUNT must be an integer from ${MIN_RUNTIME_LANE_COUNT} to ${MAX_RUNTIME_LANE_COUNT}`,
    );
  return laneCount;
};

async function main(): Promise<void> {
  consumeRuntimeLaneRedisRecreationAuthorization(
    requireRuntimeLaneRedisRecreationAuthorization(),
  );
  const laneCount = laneCountFrom(requiredEnv("RUNTIME_SWEEP_LANE_COUNT"));
  const result = await prepareRuntimeLaneInfrastructure({
    resources: runtimeLaneResources(laneCount),
    baseDatabaseUrl: requiredEnv("E2E_DATABASE_URL"),
  });
  console.log(
    `runtime-lane-infrastructure PASS lanes=${laneCount} databases-created=${result.databasesCreated} redis-created=${result.redisCreated} redis-started=${result.redisStarted} redis-ready=${result.redisReady}`,
  );
}

void main().catch((error: unknown) => {
  console.error("[runtime-lane-infrastructure] Failed:", error);
  process.exitCode = 1;
});
