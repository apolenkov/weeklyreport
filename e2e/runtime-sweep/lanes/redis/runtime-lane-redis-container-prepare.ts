import type {
  RuntimeLaneId,
  RuntimeLaneResource,
} from "../contracts/runtime-lane-contract.ts";
import {
  consumeRuntimeLaneRedisRecreationAuthorization,
  requireRuntimeLaneRedisRecreationAuthorization,
  type RuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";

const DOCKER_ID = /^[a-f0-9]{64}$/u;

interface RedisInspectionIdentity {
  readonly Id: string;
  readonly State: { readonly Running: boolean };
}

export interface RuntimeLaneRedisPrepareDependencies<
  TInspection extends RedisInspectionIdentity,
> {
  readonly execute: (args: readonly string[]) => Promise<string>;
  readonly inspect: (name: string) => Promise<TInspection | undefined>;
  readonly names: (name: string) => Promise<readonly string[]>;
  readonly wait: (port: number) => Promise<void>;
}

export interface RuntimeLaneRedisPrepareOperations<
  TInspection extends RedisInspectionIdentity,
> {
  readonly containerName: (laneId: RuntimeLaneId) => string;
  readonly runArgs: (resource: RuntimeLaneResource) => readonly string[];
  readonly assertConfiguration: (
    resource: RuntimeLaneResource,
    inspected: TInspection,
  ) => void;
  readonly assertRunning: (
    resource: RuntimeLaneResource,
    inspected: TInspection,
  ) => void;
}

const assertExactRunningInspection = <
  TInspection extends RedisInspectionIdentity,
>(
  resource: RuntimeLaneResource,
  expectedId: string,
  inspected: TInspection | undefined,
  operation: "creation" | "start" | "ready",
  assertRunning: RuntimeLaneRedisPrepareOperations<TInspection>["assertRunning"],
): void => {
  if (inspected === undefined)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis ${operation} inspect returned no row`,
    );
  assertRunning(resource, inspected);
  if (inspected.Id !== expectedId)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis ${operation} inspected identity does not match the exact requested id`,
    );
};

const createRuntimeLaneRedisContainer = async <
  TInspection extends RedisInspectionIdentity,
>(
  resource: RuntimeLaneResource,
  dependencies: RuntimeLaneRedisPrepareDependencies<TInspection>,
  operations: RuntimeLaneRedisPrepareOperations<TInspection>,
): Promise<void> => {
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
  const created = await dependencies.inspect(createdId);
  assertExactRunningInspection(
    resource,
    createdId,
    created,
    "creation",
    operations.assertRunning,
  );
};

export const prepareRuntimeLaneRedisContainerImplementation = async <
  TInspection extends RedisInspectionIdentity,
>(
  resource: RuntimeLaneResource,
  dependencies: RuntimeLaneRedisPrepareDependencies<TInspection>,
  authorization: RuntimeLaneRedisRecreationAuthorization,
  operations: RuntimeLaneRedisPrepareOperations<TInspection>,
): Promise<"created" | "started" | "ready"> => {
  consumeRuntimeLaneRedisRecreationAuthorization(authorization);
  const name = operations.containerName(resource.laneId);
  const existing = await dependencies.names(name);
  if (
    existing.length > 1 ||
    (existing[0] !== undefined && existing[0] !== name)
  )
    throw new Error(`Runtime lane ${resource.laneId} Redis name is ambiguous`);
  if (existing.length === 0) {
    await createRuntimeLaneRedisContainer(resource, dependencies, operations);
    return "created";
  }
  const inspected = await dependencies.inspect(name);
  if (inspected === undefined)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis inspect returned no row`,
    );
  operations.assertConfiguration(resource, inspected);
  if (!inspected.State.Running) {
    consumeRuntimeLaneRedisRecreationAuthorization(
      requireRuntimeLaneRedisRecreationAuthorization(),
    );
    await dependencies.execute(["start", inspected.Id]);
    await dependencies.wait(resource.redisPort);
    const started = await dependencies.inspect(inspected.Id);
    assertExactRunningInspection(
      resource,
      inspected.Id,
      started,
      "start",
      operations.assertRunning,
    );
    return "started";
  }
  operations.assertRunning(resource, inspected);
  await dependencies.wait(resource.redisPort);
  const ready = await dependencies.inspect(inspected.Id);
  assertExactRunningInspection(
    resource,
    inspected.Id,
    ready,
    "ready",
    operations.assertRunning,
  );
  return "ready";
};
