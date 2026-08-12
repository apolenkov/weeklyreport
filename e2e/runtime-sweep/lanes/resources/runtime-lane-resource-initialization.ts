import type {
  RuntimeLaneAssignment,
  RuntimeLaneResource,
} from "../contracts/runtime-lane-contract.ts";
import type { RuntimeLaneRedisRecreationAuthorization } from "../redis/runtime-lane-redis-authorization.ts";
import { requireRuntimeLaneRedisRecreationAuthorization } from "../redis/runtime-lane-redis-authorization.ts";
import { recreateRuntimeLaneRedisInfrastructure } from "../redis/runtime-lane-redis-container.ts";
import { assertRuntimeLaneReadiness } from "./runtime-lane-readiness.ts";

interface RuntimeLaneInitializationDependencies {
  readonly assertReadiness: typeof assertRuntimeLaneReadiness;
  readonly recreateRedis: (
    resources: readonly RuntimeLaneResource[],
    authorization: RuntimeLaneRedisRecreationAuthorization,
  ) => Promise<ReadonlyMap<string, string>>;
}

const DEFAULT_DEPENDENCIES: RuntimeLaneInitializationDependencies = {
  assertReadiness: assertRuntimeLaneReadiness,
  recreateRedis: (resources, authorization) =>
    recreateRuntimeLaneRedisInfrastructure(resources, undefined, authorization),
};

export async function initializeRuntimeLaneResources(
  input: Readonly<{
    readonly assignment: RuntimeLaneAssignment;
    readonly baseDatabaseUrl: string;
    readonly redisRecreationAuthorized: boolean;
  }>,
  dependencies: RuntimeLaneInitializationDependencies = DEFAULT_DEPENDENCIES,
): Promise<ReadonlyMap<string, string>> {
  if (!input.redisRecreationAuthorized)
    throw new Error(
      "Runtime lane Redis recreation requires RUNTIME_SWEEP_REDIS_RECREATE=true",
    );
  const authorization = requireRuntimeLaneRedisRecreationAuthorization();
  await dependencies.recreateRedis(input.assignment.lanes, authorization);
  return dependencies.assertReadiness({
    assignment: input.assignment,
    baseDatabaseUrl: input.baseDatabaseUrl,
  });
}
