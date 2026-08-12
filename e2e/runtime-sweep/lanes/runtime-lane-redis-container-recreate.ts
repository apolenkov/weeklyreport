import type {
  RuntimeLaneId,
  RuntimeLaneResource,
} from "./runtime-lane-contract.ts";
import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
  type RuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";
import type {
  RuntimeLaneRedisPrepareDependencies,
  RuntimeLaneRedisPrepareOperations,
} from "./runtime-lane-redis-container-prepare.ts";

const DOCKER_ID = /^[a-f0-9]{64}$/u;

interface RedisInspectionIdentity {
  readonly Id: string;
  readonly State: { readonly Running: boolean };
}

const assertExactCreation = <TInspection extends RedisInspectionIdentity>(
  resource: RuntimeLaneResource,
  createdId: string,
  inspected: TInspection | undefined,
  assertRunning: RuntimeLaneRedisPrepareOperations<TInspection>["assertRunning"],
): void => {
  if (inspected === undefined)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis recreation inspect returned no row`,
    );
  assertRunning(resource, inspected);
  if (inspected.Id !== createdId)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis inspected identity does not match its creation result`,
    );
};

const createContainer = async <TInspection extends RedisInspectionIdentity>(
  resource: RuntimeLaneResource,
  dependencies: RuntimeLaneRedisPrepareDependencies<TInspection>,
  operations: RuntimeLaneRedisPrepareOperations<TInspection>,
): Promise<string> => {
  consumeRuntimeLaneRedisRecreationAuthorization(
    requireRuntimeLaneRedisRecreationAuthorization(),
  );
  const createdId = (
    await dependencies.execute(operations.runArgs(resource))
  ).trim();
  if (!DOCKER_ID.test(createdId))
    throw new Error(
      `Runtime lane ${resource.laneId} Redis creation returned an invalid container identity`,
    );
  await dependencies.wait(resource.redisPort);
  const inspected = await dependencies.inspect(createdId);
  assertExactCreation(resource, createdId, inspected, operations.assertRunning);
  return createdId;
};

const recreateContainer = async <TInspection extends RedisInspectionIdentity>(
  resource: RuntimeLaneResource,
  dependencies: RuntimeLaneRedisPrepareDependencies<TInspection>,
  operations: RuntimeLaneRedisPrepareOperations<TInspection>,
): Promise<string> => {
  const name = operations.containerName(resource.laneId);
  const existing = await dependencies.names(name);
  if (
    existing.length > 1 ||
    (existing[0] !== undefined && existing[0] !== name)
  )
    throw new Error(
      `Runtime lane ${resource.laneId} Redis container identity is ambiguous`,
    );
  const previous =
    existing.length === 0 ? undefined : await dependencies.inspect(name);
  if (existing.length > 0 && previous === undefined)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis inspect returned no row`,
    );
  if (previous !== undefined) {
    operations.assertConfiguration(resource, previous);
    consumeRuntimeLaneRedisRecreationAuthorization(
      requireRuntimeLaneRedisRecreationAuthorization(),
    );
    await dependencies.execute(["rm", "--force", "--volumes", previous.Id]);
  }
  const createdId = await createContainer(resource, dependencies, operations);
  if (previous?.Id === createdId)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis container identity did not change`,
    );
  return createdId;
};

export const recreateRuntimeLaneRedisInfrastructureImplementation = async <
  TInspection extends RedisInspectionIdentity,
>(
  resources: readonly RuntimeLaneResource[],
  dependencies: RuntimeLaneRedisPrepareDependencies<TInspection>,
  authorization: RuntimeLaneRedisRecreationAuthorization,
  operations: RuntimeLaneRedisPrepareOperations<TInspection>,
): Promise<ReadonlyMap<RuntimeLaneId, string>> => {
  consumeRuntimeLaneRedisRecreationAuthorization(authorization);
  if (resources.length === 0)
    throw new Error("Runtime lane Redis recreation requires at least one lane");
  const identities = await resources.reduce<
    Promise<readonly (readonly [RuntimeLaneId, string])[]>
  >(
    async (previous, resource) => [
      ...(await previous),
      [
        resource.laneId,
        await recreateContainer(resource, dependencies, operations),
      ] as const,
    ],
    Promise.resolve([]),
  );
  return new Map(identities);
};
