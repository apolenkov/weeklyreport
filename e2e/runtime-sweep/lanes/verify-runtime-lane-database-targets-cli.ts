import { stableSerialize } from "../support/ids.ts";
import {
  runtimeLaneCountFrom,
  verifyRuntimeLaneDatabaseTargets,
} from "./resources/runtime-lane-target-verification.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Runtime database target verification requires ${name}`);
  return value;
};

const main = (): void => {
  const result = verifyRuntimeLaneDatabaseTargets({
    baseDatabaseUrl: requiredEnv("E2E_DATABASE_URL"),
    developerDatabaseUrl: requiredEnv("DATABASE_URL"),
    laneCount: runtimeLaneCountFrom(requiredEnv("RUNTIME_SWEEP_LANE_COUNT")),
    ...(process.env.NODE_ENV === undefined
      ? {}
      : { nodeEnv: process.env.NODE_ENV }),
  });
  console.log(stableSerialize(result));
};

try {
  main();
} catch (error: unknown) {
  console.error("[runtime-database-target-verification] Failed:", error);
  process.exitCode = 1;
}
