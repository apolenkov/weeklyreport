import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";

import { z } from "zod";

import type {
  RuntimeLaneId,
  RuntimeLaneResource,
} from "./runtime-lane-contract.ts";
import {
  requireRuntimeLaneRedisRecreationAuthorization,
  type RuntimeLaneRedisRecreationAuthorization,
} from "./runtime-lane-redis-authorization.ts";
import { prepareRuntimeLaneRedisContainerImplementation } from "./runtime-lane-redis-container-prepare.ts";
import { recreateRuntimeLaneRedisInfrastructureImplementation } from "./runtime-lane-redis-container-recreate.ts";

const execFileAsync = promisify(execFile);
const REDIS_IMAGE =
  "redis:7-alpine@sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99";
const REDIS_CONTAINER_PORT = "6379/tcp";
const REDIS_LABEL = "customreport.runtime-sweep-lane";
const REDIS_COMMAND = ["redis-server", "--save", "", "--appendonly", "no"];
const REDIS_ENTRYPOINT = ["docker-entrypoint.sh"];
const REDIS_START_TIMEOUT_MS = 10_000;
const REDIS_POLL_MS = 100;
const DOCKER_ID = /^[a-f0-9]{64}$/u;

const dockerInspectSchema = z
  .array(
    z.looseObject({
      Id: z.string(),
      Name: z.string(),
      Config: z.looseObject({
        Cmd: z.array(z.string()).nullable(),
        Entrypoint: z.array(z.string()).nullable(),
        Image: z.string(),
        Labels: z.record(z.string(), z.string()).nullable(),
      }),
      HostConfig: z.looseObject({
        NetworkMode: z.string(),
        PortBindings: z.record(
          z.string(),
          z
            .array(
              z.object({ HostIp: z.string(), HostPort: z.string() }).strict(),
            )
            .nullable(),
        ),
        RestartPolicy: z.looseObject({
          MaximumRetryCount: z.number(),
          Name: z.string(),
        }),
      }),
      Mounts: z.array(
        z.looseObject({
          Destination: z.string(),
          Driver: z.string(),
          Name: z.string(),
          RW: z.boolean(),
          Type: z.string(),
        }),
      ),
      State: z.looseObject({ Running: z.boolean() }),
    }),
  )
  .length(1);

type RedisInspection = z.infer<typeof dockerInspectSchema>[number];

interface RedisContainerLifecycleDependencies {
  readonly execute: (args: readonly string[]) => Promise<string>;
  readonly inspect: typeof inspectContainer;
  readonly names: typeof containerNames;
  readonly wait: typeof waitForPort;
}

export const runtimeLaneRedisContainerName = (laneId: RuntimeLaneId): string =>
  `weeklyreport-runtime-lane-${laneId}-redis`;

export const runtimeLaneRedisRunArgs = (
  resource: RuntimeLaneResource,
): readonly string[] => [
  "run",
  "--detach",
  "--name",
  runtimeLaneRedisContainerName(resource.laneId),
  "--label",
  `${REDIS_LABEL}=${resource.laneId}`,
  "--publish",
  `127.0.0.1:${String(resource.redisPort)}:6379`,
  REDIS_IMAGE,
  ...REDIS_COMMAND,
];

const containerNames = async (name: string): Promise<readonly string[]> => {
  const { stdout } = await execFileAsync("docker", [
    "container",
    "ls",
    "--all",
    "--filter",
    `name=^/${name}$`,
    "--format",
    "{{.Names}}",
  ]);
  return stdout.trim().split(/\s+/u).filter(Boolean);
};

const inspectContainer = async (name: string) => {
  const { stdout } = await execFileAsync("docker", ["inspect", name]);
  return dockerInspectSchema.parse(JSON.parse(stdout))[0];
};

const hasCanonicalBinding = (
  resource: RuntimeLaneResource,
  inspected: RedisInspection,
): boolean => {
  const bindings =
    inspected.HostConfig.PortBindings[REDIS_CONTAINER_PORT] ?? [];
  return (
    Object.keys(inspected.HostConfig.PortBindings).length === 1 &&
    bindings.length === 1 &&
    bindings.some(
      ({ HostIp, HostPort }) =>
        HostIp === "127.0.0.1" && HostPort === String(resource.redisPort),
    )
  );
};

const hasCanonicalMount = (inspected: RedisInspection): boolean => {
  const mount = inspected.Mounts[0];
  return [
    inspected.Mounts.length === 1,
    mount?.Type === "volume",
    mount?.Driver === "local",
    mount?.Destination === "/data",
    mount?.RW === true,
    mount !== undefined && DOCKER_ID.test(mount.Name),
  ].every(Boolean);
};

const assertRuntimeLaneRedisContainerConfiguration = (
  resource: RuntimeLaneResource,
  inspected: RedisInspection,
): void => {
  const labels = inspected.Config.Labels ?? {};
  const matches = [
    DOCKER_ID.test(inspected.Id),
    inspected.Name === `/${runtimeLaneRedisContainerName(resource.laneId)}`,
    inspected.Config.Image === REDIS_IMAGE,
    JSON.stringify(inspected.Config.Cmd) === JSON.stringify(REDIS_COMMAND),
    JSON.stringify(inspected.Config.Entrypoint) ===
      JSON.stringify(REDIS_ENTRYPOINT),
    Object.keys(labels).length === 1,
    labels[REDIS_LABEL] === resource.laneId,
    hasCanonicalBinding(resource, inspected),
    inspected.HostConfig.NetworkMode === "bridge",
    inspected.HostConfig.RestartPolicy.Name === "no",
    inspected.HostConfig.RestartPolicy.MaximumRetryCount === 0,
    hasCanonicalMount(inspected),
  ].every(Boolean);
  if (!matches)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis container does not match its canonical resource tuple`,
    );
};

export const assertRuntimeLaneRedisContainer = (
  resource: RuntimeLaneResource,
  inspected: RedisInspection,
): void => {
  assertRuntimeLaneRedisContainerConfiguration(resource, inspected);
  if (!inspected.State.Running)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis container does not match its canonical resource tuple`,
    );
};

const waitForPort = (port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const probe = (): void => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      const retry = (): void => {
        socket.destroy();
        if (Date.now() - startedAt >= REDIS_START_TIMEOUT_MS) {
          reject(new Error(`Runtime lane Redis ${port} did not become ready`));
          return;
        }
        setTimeout(probe, REDIS_POLL_MS);
      };
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", retry);
    };
    probe();
  });

const DEFAULT_LIFECYCLE_DEPENDENCIES: RedisContainerLifecycleDependencies = {
  execute: async (args) => (await execFileAsync("docker", [...args])).stdout,
  inspect: inspectContainer,
  names: containerNames,
  wait: waitForPort,
};

export const prepareRuntimeLaneRedisContainer = async (
  resource: RuntimeLaneResource,
  dependencies: RedisContainerLifecycleDependencies = DEFAULT_LIFECYCLE_DEPENDENCIES,
  authorization: RuntimeLaneRedisRecreationAuthorization = requireRuntimeLaneRedisRecreationAuthorization(),
): Promise<"created" | "started" | "ready"> => {
  return prepareRuntimeLaneRedisContainerImplementation(
    resource,
    dependencies,
    authorization,
    {
      containerName: runtimeLaneRedisContainerName,
      runArgs: runtimeLaneRedisRunArgs,
      assertConfiguration: assertRuntimeLaneRedisContainerConfiguration,
      assertRunning: assertRuntimeLaneRedisContainer,
    },
  );
};

export const recreateRuntimeLaneRedisInfrastructure = async (
  resources: readonly RuntimeLaneResource[],
  dependencies: RedisContainerLifecycleDependencies = DEFAULT_LIFECYCLE_DEPENDENCIES,
  authorization: RuntimeLaneRedisRecreationAuthorization = requireRuntimeLaneRedisRecreationAuthorization(),
) =>
  recreateRuntimeLaneRedisInfrastructureImplementation(
    resources,
    dependencies,
    authorization,
    {
      containerName: runtimeLaneRedisContainerName,
      runArgs: runtimeLaneRedisRunArgs,
      assertConfiguration: assertRuntimeLaneRedisContainerConfiguration,
      assertRunning: assertRuntimeLaneRedisContainer,
    },
  );
