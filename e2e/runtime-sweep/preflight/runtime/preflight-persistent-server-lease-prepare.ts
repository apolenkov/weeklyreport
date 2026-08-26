import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import { spawnDetachedProcessGroup } from "../launch/bounded/preflight-detached-process-group.ts";
import {
  persistentServerEnvironmentsFor,
  type PersistentServerGroup,
  type PersistentServerLaunchSpec,
  persistentServerLaunchSpecsFor,
  serverRecordFor,
} from "./preflight-persistent-server-launch.ts";
import {
  LOOPBACK_HOST,
  type PersistentServerLease,
} from "./preflight-persistent-server-lease-contract.ts";
import {
  throwIfAborted,
  waitForPersistentServerHealth,
  waitForPersistentServerNoResidue,
} from "./preflight-persistent-server-lease-probes.ts";

const DEFAULT_HEALTH_TIMEOUT_MS = 180_000;
const MIN_PORT = 1;

const assertPort = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < MIN_PORT)
    throw new Error(`Persistent server lease requires a valid ${name}`);
};

const assertPositiveTimeout = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value < MIN_PORT)
    throw new Error(`Persistent server lease requires a positive ${name}`);
};

const assertLeasePath = (input: {
  readonly archiveRoot: string;
  readonly leasePath?: string;
}): string => {
  const candidate =
    input.leasePath ??
    path.join(
      input.archiveRoot,
      "5.19-admin-demo",
      "PREFLIGHT_SERVER_LEASE.json",
    );
  const leasePath = path.resolve(candidate);
  if (leasePath !== candidate)
    throw new Error(
      "Persistent server lease path must be normalized and absolute",
    );
  return leasePath;
};

export const preparePersistentServerLaunch = async (input: {
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly leasePath?: string;
  readonly healthTimeoutMs?: number;
  readonly signal?: AbortSignal;
}): Promise<
  Readonly<{
    readonly apiPort: number;
    readonly webPort: number;
    readonly healthTimeoutMs: number;
    readonly leasePath: string;
    readonly specs: readonly PersistentServerLaunchSpec[];
  }>
> => {
  throwIfAborted(input.signal);
  const apiPort = Number(input.environment.E2E_API_PORT);
  const webPort = Number(input.environment.E2E_WEB_PORT);
  assertPort(apiPort, "E2E_API_PORT");
  assertPort(webPort, "E2E_WEB_PORT");
  if (apiPort === webPort)
    throw new Error(
      "Persistent server lease requires distinct API and web ports",
    );
  const healthTimeoutMs = input.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS;
  assertPositiveTimeout(healthTimeoutMs, "health timeout");
  const leasePath = assertLeasePath(input);
  await mkdir(path.dirname(leasePath), { recursive: true, mode: 0o700 });
  await mkdir(path.join(input.archiveRoot, "api-log", "preflight"), {
    recursive: true,
    mode: 0o700,
  });
  await mkdir(path.join(input.archiveRoot, "pdfs", "preflight"), {
    recursive: true,
    mode: 0o700,
  });
  throwIfAborted(input.signal);
  const servers = persistentServerEnvironmentsFor({
    inherited: input.environment,
    archiveRoot: input.archiveRoot,
    apiPort,
    webPort,
  });
  return {
    apiPort,
    webPort,
    healthTimeoutMs,
    leasePath,
    specs: persistentServerLaunchSpecsFor({
      repoRoot: input.repoRoot,
      environment: input.environment,
      servers,
      apiPort,
      webPort,
    }),
  };
};

export const launchPersistentServerGroups = async (input: {
  readonly specs: readonly PersistentServerLaunchSpec[];
  readonly repoRoot: string;
  readonly apiPort: number;
  readonly webPort: number;
  readonly healthTimeoutMs: number;
  readonly groups: PersistentServerGroup[];
  readonly signal?: AbortSignal;
}): Promise<void> => {
  for (const spec of input.specs) {
    throwIfAborted(input.signal);
    const handle = await spawnDetachedProcessGroup({
      operationName: `Persistent preflight ${spec.name} server`,
      command: spec.command,
      args: spec.args,
      repoRoot: input.repoRoot,
      cwd: spec.cwd,
      environment: spec.environment,
      closeGraceMs: 10_000,
    });
    input.groups.push({ name: spec.name, handle });
    throwIfAborted(input.signal);
    const port = spec.name === "api" ? input.apiPort : input.webPort;
    const healthUrl =
      spec.name === "api"
        ? `http://${LOOPBACK_HOST}:${String(input.apiPort)}/health/ready`
        : `http://${LOOPBACK_HOST}:${String(input.webPort)}/`;
    await waitForPersistentServerHealth(
      serverRecordFor({
        name: spec.name,
        ownership: handle.ownership,
        port,
        healthUrl,
        cwd: spec.cwd,
        command: spec.command,
        args: spec.args,
      }),
      input.healthTimeoutMs,
      input.signal,
    );
    throwIfAborted(input.signal);
  }
};

export const closePersistentServerGroups = async (
  groups: readonly PersistentServerGroup[],
  lease: PersistentServerLease,
): Promise<void> => {
  const failures: unknown[] = [];
  for (const group of [...groups].reverse()) {
    try {
      await group.handle.close();
    } catch (error: unknown) {
      failures.push(error);
    }
  }
  for (const server of lease.servers) {
    try {
      await waitForPersistentServerNoResidue(server);
    } catch (error: unknown) {
      failures.push(error);
    }
  }
  if (failures.length > 0)
    throw new AggregateError(
      failures,
      `Persistent preflight server cleanup failures=${String(failures.length)}`,
    );
};
