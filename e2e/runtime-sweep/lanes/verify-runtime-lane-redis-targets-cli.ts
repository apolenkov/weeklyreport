import { stableSerialize } from "../support/ids.ts";
import {
  runtimeLaneCountFrom,
  verifyRuntimeLaneRedisTargets,
} from "./runtime-lane-target-verification.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Runtime Redis target verification requires ${name}`);
  return value;
};

const main = (): void => {
  const result = verifyRuntimeLaneRedisTargets({
    flushValue: requiredEnv("E2E_REDIS_FLUSH"),
    host: requiredEnv("REDIS_HOST"),
    laneCount: runtimeLaneCountFrom(requiredEnv("RUNTIME_SWEEP_LANE_COUNT")),
    recreationValue: requiredEnv("RUNTIME_SWEEP_REDIS_RECREATE"),
  });
  console.log(stableSerialize(result));
};

try {
  main();
} catch (error: unknown) {
  console.error("[runtime-redis-target-verification] Failed:", error);
  process.exitCode = 1;
}
