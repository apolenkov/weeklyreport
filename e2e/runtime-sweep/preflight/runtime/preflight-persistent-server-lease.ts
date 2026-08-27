import { writeFile } from "node:fs/promises";

import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import { combineFailures } from "../launch/bounded/preflight-detached-process-group.ts";
import {
  leaseEnvironmentFor,
  type PersistentServerGroup,
  type PersistentServerLaunchSpec,
  serverRecordFor,
} from "./preflight-persistent-server-launch.ts";
import {
  fileDigest,
  LEASE_ARTIFACT,
  LEASE_VERSION,
  LOOPBACK_HOST,
  parsePersistentServerLease,
  type PersistentServerLease,
  type PersistentServerLeaseExpected,
  type PersistentServerLeaseHandle,
} from "./preflight-persistent-server-lease-contract.ts";
import {
  closePersistentServerGroups,
  launchPersistentServerGroups,
  preparePersistentServerLaunch,
} from "./preflight-persistent-server-lease-prepare.ts";
import { assertPersistentServerLease } from "./preflight-persistent-server-lease-probes.ts";

export * from "./preflight-persistent-server-lease-contract.ts";
export * from "./preflight-persistent-server-lease-environment.ts";
export {
  assertPersistentServerLease,
  assertPersistentServerListenerOwned,
  waitForPersistentServerNoResidue,
} from "./preflight-persistent-server-lease-probes.ts";

const recordsFor = (input: {
  readonly specs: readonly PersistentServerLaunchSpec[];
  readonly groups: readonly PersistentServerGroup[];
  readonly apiPort: number;
  readonly webPort: number;
}): readonly [
  ReturnType<typeof serverRecordFor>,
  ReturnType<typeof serverRecordFor>,
] => {
  const records = input.specs.map((spec) => {
    const group = input.groups.find(
      (candidate) => candidate.name === spec.name,
    );
    if (group === undefined)
      throw new Error(`Persistent preflight ${spec.name} group is missing`);
    return serverRecordFor({
      name: spec.name,
      ownership: group.handle.ownership,
      port: spec.name === "api" ? input.apiPort : input.webPort,
      healthUrl:
        spec.name === "api"
          ? `http://${LOOPBACK_HOST}:${String(input.apiPort)}/health/ready`
          : `http://${LOOPBACK_HOST}:${String(input.webPort)}/`,
      cwd: spec.cwd,
      command: spec.command,
      args: spec.args,
    });
  });
  const apiServer = records.find((server) => server.name === "api");
  const webServer = records.find((server) => server.name === "web");
  if (apiServer === undefined || webServer === undefined)
    throw new Error("Persistent preflight server records are incomplete");
  return [apiServer, webServer];
};

const leaseFor = (input: {
  readonly source: SourceArtifact;
  readonly attemptId: string;
  readonly records: readonly [
    ReturnType<typeof serverRecordFor>,
    ReturnType<typeof serverRecordFor>,
  ];
}): PersistentServerLease =>
  parsePersistentServerLease({
    artifact: LEASE_ARTIFACT,
    version: LEASE_VERSION,
    campaignId: input.source.campaignId,
    attemptId: input.attemptId,
    sourceSha: input.source.sourceSha,
    sourceTree: input.source.sourceTree,
    sourceDigest: input.source.sourceDigest,
    createdAt: new Date().toISOString(),
    servers: input.records,
  });

const createHandle = async (input: {
  readonly leasePath: string;
  readonly lease: PersistentServerLease;
  readonly groups: readonly PersistentServerGroup[];
  readonly expected: PersistentServerLeaseExpected;
}): Promise<PersistentServerLeaseHandle> => {
  const text = `${stableSerialize(input.lease)}\n`;
  await writeFile(input.leasePath, text, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  const digest = fileDigest(text);
  await assertPersistentServerLease({
    path: input.leasePath,
    digest,
    expected: input.expected,
  });
  const closeState: { promise?: Promise<void> } = {};
  const close = (): Promise<void> => {
    closeState.promise ??= closePersistentServerGroups(
      input.groups,
      input.lease,
    );
    return closeState.promise;
  };
  return {
    path: input.leasePath,
    digest,
    lease: input.lease,
    environment: leaseEnvironmentFor({
      path: input.leasePath,
      digest,
      sourceTree: input.lease.sourceTree,
      campaignId: input.lease.campaignId,
      attemptId: input.lease.attemptId,
    }),
    assertLive: async () => {
      await assertPersistentServerLease({
        path: input.leasePath,
        digest,
        expected: input.expected,
      });
    },
    close,
  };
};

const cleanupStartedGroups = async (
  groups: readonly PersistentServerGroup[],
): Promise<readonly unknown[]> => {
  const failures: unknown[] = [];
  for (const group of [...groups].reverse()) {
    try {
      await group.handle.close();
    } catch (error: unknown) {
      failures.push(error);
    }
  }
  return failures;
};

export const startPersistentPreflightServers = async (input: {
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly source: SourceArtifact;
  readonly attemptId: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly leasePath?: string;
  readonly healthTimeoutMs?: number;
  readonly signal?: AbortSignal;
}): Promise<PersistentServerLeaseHandle> => {
  const launch = await preparePersistentServerLaunch(input);
  const groups: PersistentServerGroup[] = [];
  try {
    await launchPersistentServerGroups({
      specs: launch.specs,
      repoRoot: input.repoRoot,
      apiPort: launch.apiPort,
      webPort: launch.webPort,
      healthTimeoutMs: launch.healthTimeoutMs,
      groups,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const lease = leaseFor({
      source: input.source,
      attemptId: input.attemptId,
      records: recordsFor({
        specs: launch.specs,
        groups,
        apiPort: launch.apiPort,
        webPort: launch.webPort,
      }),
    });
    return await createHandle({
      leasePath: launch.leasePath,
      lease,
      groups,
      expected: {
        campaignId: lease.campaignId,
        attemptId: lease.attemptId,
        sourceSha: lease.sourceSha,
        sourceTree: lease.sourceTree,
        apiPort: launch.apiPort,
        webPort: launch.webPort,
      },
    });
  } catch (error: unknown) {
    const cleanupFailures = await cleanupStartedGroups(groups);
    throw combineFailures(
      "Persistent preflight server startup",
      error,
      cleanupFailures,
    );
  }
};
