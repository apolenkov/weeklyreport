import { execFile } from "node:child_process";
import net from "node:net";
import { promisify } from "node:util";

import pg from "pg";
import { z } from "zod";

import type {
  RuntimeLaneId,
  RuntimeLaneResource,
} from "./runtime-lane-contract.ts";
import { runtimeLaneDatabaseUrl } from "./runtime-lane-readiness.ts";

const execFileAsync = promisify(execFile);
const REDIS_IMAGE =
  "redis:7-alpine@sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99";
const REDIS_CONTAINER_PORT = "6379/tcp";
const REDIS_LABEL = "customreport.runtime-sweep-lane";
const REDIS_START_TIMEOUT_MS = 10_000;
const REDIS_POLL_MS = 100;
const DATABASE_NAME = /^customreport_e2e_lane_[a-o]_test$/u;

const dockerInspectSchema = z
  .array(
    z.looseObject({
      Config: z.looseObject({
        Image: z.string(),
        Labels: z.record(z.string(), z.string()).nullable(),
      }),
      HostConfig: z.looseObject({
        PortBindings: z.record(
          z.string(),
          z
            .array(
              z.object({ HostIp: z.string(), HostPort: z.string() }).strict(),
            )
            .nullable(),
        ),
      }),
      State: z.looseObject({ Running: z.boolean() }),
    }),
  )
  .length(1);

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
  "redis-server",
  "--save",
  "",
  "--appendonly",
  "no",
];

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
  return stdout
    .split("\n")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
};

const inspectContainer = async (name: string) => {
  const { stdout } = await execFileAsync("docker", ["inspect", name]);
  return dockerInspectSchema.parse(JSON.parse(stdout))[0];
};

const assertRedisContainer = (
  resource: RuntimeLaneResource,
  inspected: z.infer<typeof dockerInspectSchema>[number],
): void => {
  const bindings =
    inspected.HostConfig.PortBindings[REDIS_CONTAINER_PORT] ?? [];
  const bindingMatches =
    bindings.length === 1 &&
    bindings.some(
      ({ HostIp, HostPort }) =>
        HostIp === "127.0.0.1" && HostPort === String(resource.redisPort),
    );
  if (
    inspected.Config.Image !== REDIS_IMAGE ||
    inspected.Config.Labels?.[REDIS_LABEL] !== resource.laneId ||
    !bindingMatches
  )
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

const prepareRedisContainer = async (
  resource: RuntimeLaneResource,
): Promise<"created" | "started" | "ready"> => {
  const name = runtimeLaneRedisContainerName(resource.laneId);
  const existing = await containerNames(name);
  if (
    existing.length > 1 ||
    (existing[0] !== undefined && existing[0] !== name)
  )
    throw new Error(`Runtime lane ${resource.laneId} Redis name is ambiguous`);
  if (existing.length === 0) {
    await execFileAsync("docker", [...runtimeLaneRedisRunArgs(resource)]);
    await waitForPort(resource.redisPort);
    return "created";
  }
  const inspected = await inspectContainer(name);
  if (inspected === undefined)
    throw new Error(
      `Runtime lane ${resource.laneId} Redis inspect returned no row`,
    );
  assertRedisContainer(resource, inspected);
  if (!inspected.State.Running) {
    await execFileAsync("docker", ["start", name]);
    await waitForPort(resource.redisPort);
    return "started";
  }
  await waitForPort(resource.redisPort);
  return "ready";
};

export interface RuntimeLaneInfrastructureResult {
  readonly databasesCreated: number;
  readonly redisCreated: number;
  readonly redisStarted: number;
  readonly redisReady: number;
}

export async function prepareRuntimeLaneInfrastructure(
  input: Readonly<{
    readonly resources: readonly RuntimeLaneResource[];
    readonly baseDatabaseUrl: string;
  }>,
): Promise<RuntimeLaneInfrastructureResult> {
  if (input.resources.length === 0)
    throw new Error("Runtime lane infrastructure requires at least one lane");
  const databasesCreated = await prepareDatabases(
    input.resources,
    input.baseDatabaseUrl,
  );
  const redisStates = await Promise.all(
    input.resources.map((resource) => prepareRedisContainer(resource)),
  );
  return {
    databasesCreated,
    redisCreated: redisStates.filter((state) => state === "created").length,
    redisStarted: redisStates.filter((state) => state === "started").length,
    redisReady: redisStates.filter((state) => state === "ready").length,
  };
}
