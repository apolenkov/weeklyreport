import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import {
  assertPersistentServerLease,
  assertPersistentServerLeaseAttemptBinding,
  assertPersistentServerLeaseIdentity,
  assertPersistentServerListenerOwned,
  parsePersistentServerLease,
  persistentServerLeaseEnvironmentState,
  PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV,
  PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV,
  PREFLIGHT_SERVER_LEASE_ENV,
  PREFLIGHT_SERVER_LEASE_SHA_ENV,
  PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV,
  readPersistentServerLease,
  waitForPersistentServerNoResidue,
} from "./preflight-persistent-server-lease.ts";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const execFileSyncMock = vi.mocked(execFileSync);

afterEach(() => {
  execFileSyncMock.mockReset();
});

const TEST_ROOT_PREFIX = ".preflight-server-lease-";
const sourceSha = "a".repeat(40);
const sourceTree = "b".repeat(40);
const sourceDigest = "c".repeat(64);
const command = (
  name: string,
): Readonly<{
  readonly command: string;
  readonly cwd: string;
  readonly args: readonly string[];
  readonly commandDigest: string;
}> => {
  const cwd = `/tmp/${name}`;
  const args = [name, "--test"];
  return {
    command: "/usr/bin/node",
    cwd,
    args,
    commandDigest: sha256Hex({ command: "/usr/bin/node", cwd, args }),
  };
};

const server = (name: "api" | "web", port: number, pid: number) => ({
  name,
  host: "127.0.0.1" as const,
  port,
  healthUrl:
    name === "api"
      ? `http://127.0.0.1:${String(port)}/health/ready`
      : `http://127.0.0.1:${String(port)}/`,
  pid,
  pgid: pid,
  uid: 501,
  startToken: `Wed Aug 26 17:00:0${String(pid % 10)} 2026`,
  ...command(name),
});

const fixture = () =>
  parsePersistentServerLease({
    artifact: "PREFLIGHT_SERVER_LEASE",
    version: 1,
    campaignId: "campaign-fixture",
    attemptId: "reveal-attempt-fixture",
    sourceSha,
    sourceTree,
    sourceDigest,
    createdAt: "2026-08-26T17:00:00.000Z",
    servers: [server("api", 3102, 1001), server("web", 3105, 1002)],
  });

const serializedFixture = () => {
  const text = `${stableSerialize(fixture())}\n`;
  return {
    text,
    digest: createHash("sha256").update(text, "utf8").digest("hex"),
  };
};

describe("persistent preflight server lease", () => {
  it("requires the lease, parent, and child to share one continuation attempt", () => {
    expect(() =>
      assertPersistentServerLeaseAttemptBinding({
        leaseAttemptId: "attempt-fixture",
        activeAttemptId: "attempt-fixture",
        childAttemptId: "attempt-fixture",
      }),
    ).not.toThrow();
    expect(() =>
      assertPersistentServerLeaseAttemptBinding({
        leaseAttemptId: "attempt-fixture",
        activeAttemptId: "attempt-fixture",
        childAttemptId: "other-attempt",
      }),
    ).toThrow(/attempt identity mismatch/u);
  });

  it("requires an all-or-nothing path and digest environment pair", () => {
    expect(persistentServerLeaseEnvironmentState({})).toBeUndefined();
    expect(() =>
      persistentServerLeaseEnvironmentState({
        [PREFLIGHT_SERVER_LEASE_ENV]: path.join(process.cwd(), "lease.json"),
      }),
    ).toThrow(/all path, SHA256/u);
    expect(() =>
      persistentServerLeaseEnvironmentState({
        [PREFLIGHT_SERVER_LEASE_ENV]: path.join(process.cwd(), "lease.json"),
        [PREFLIGHT_SERVER_LEASE_SHA_ENV]: "d".repeat(64),
        [PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV]: sourceTree,
        [PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV]: "campaign-fixture",
      }),
    ).toThrow(/all path, SHA256/u);
    expect(
      persistentServerLeaseEnvironmentState({
        [PREFLIGHT_SERVER_LEASE_ENV]: path.join(process.cwd(), "lease.json"),
        [PREFLIGHT_SERVER_LEASE_SHA_ENV]: "d".repeat(64),
        [PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV]: sourceTree,
        [PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV]: "campaign-fixture",
        [PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV]: "attempt-fixture",
      }),
    ).toEqual({
      path: path.join(process.cwd(), "lease.json"),
      digest: "d".repeat(64),
      sourceTree,
      campaignId: "campaign-fixture",
      attemptId: "attempt-fixture",
    });
  });

  it("binds the immutable file to campaign, attempt, source, and ports", async () => {
    const root = await mkdtemp(path.join(process.cwd(), TEST_ROOT_PREFIX));
    try {
      const leasePath = path.join(root, "lease.json");
      const serialized = serializedFixture();
      await writeFile(leasePath, serialized.text, {
        encoding: "utf8",
        mode: 0o600,
      });
      const file = await readPersistentServerLease({
        path: leasePath,
        digest: serialized.digest,
      });
      assertPersistentServerLeaseIdentity(file.lease, {
        campaignId: "campaign-fixture",
        attemptId: "reveal-attempt-fixture",
        sourceSha,
        sourceTree,
        apiPort: 3102,
        webPort: 3105,
      });
      await expect(
        assertPersistentServerLease({
          path: leasePath,
          digest: serialized.digest,
          expected: {
            campaignId: "campaign-fixture",
            attemptId: "reveal-attempt-fixture",
            sourceSha: "d".repeat(40),
            sourceTree,
            apiPort: 3102,
            webPort: 3105,
          },
          probe: {
            processGroup: () => undefined,
            listener: () => undefined,
            health: () => Promise.resolve(),
          },
        }),
      ).rejects.toThrow(/source SHA identity mismatch/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("proves both owned servers before allowing a child", async () => {
    const root = await mkdtemp(path.join(process.cwd(), TEST_ROOT_PREFIX));
    try {
      const leasePath = path.join(root, "lease.json");
      const serialized = serializedFixture();
      await writeFile(leasePath, serialized.text, {
        encoding: "utf8",
        mode: 0o600,
      });
      const events: string[] = [];
      await assertPersistentServerLease({
        path: leasePath,
        digest: serialized.digest,
        expected: {
          campaignId: "campaign-fixture",
          attemptId: "reveal-attempt-fixture",
          sourceSha,
          sourceTree,
          apiPort: 3102,
          webPort: 3105,
        },
        probe: {
          processGroup: (value) => events.push(`${value.name}:process`),
          listener: (value) => events.push(`${value.name}:listener`),
          health: (value) => {
            events.push(`${value.name}:health`);
            return Promise.resolve();
          },
        },
      });
      expect(events).toEqual([
        "api:process",
        "api:listener",
        "api:health",
        "web:process",
        "web:listener",
        "web:health",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when the lease file changes or gains an unknown field", async () => {
    const root = await mkdtemp(path.join(process.cwd(), TEST_ROOT_PREFIX));
    try {
      const leasePath = path.join(root, "lease.json");
      const serialized = serializedFixture();
      await writeFile(leasePath, `${serialized.text.trim()}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await writeFile(leasePath, `${serialized.text.trim()}\n `, {
        encoding: "utf8",
        mode: 0o600,
      });
      await expect(
        readPersistentServerLease({
          path: leasePath,
          digest: serialized.digest,
        }),
      ).rejects.toThrow(/digest changed/u);
      const unknown = { ...fixture(), unexpected: true };
      expect(() => parsePersistentServerLease(unknown)).toThrow(
        /unknown fields/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("treats lsof status 1 as a clean no-listener result", async () => {
    execFileSyncMock.mockImplementation(() => {
      throw Object.assign(new Error("no listeners"), { status: 1 });
    });
    const kill = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("gone"), { code: "ESRCH" });
    });
    try {
      await expect(
        waitForPersistentServerNoResidue(fixture().servers[0]),
      ).resolves.toBeUndefined();
    } finally {
      kill.mockRestore();
    }
  });

  it("rejects a listener whose process group or uid is foreign", () => {
    execFileSyncMock.mockImplementation((command) => {
      if (command === "/usr/sbin/lsof") return "p999\n";
      return "999 999 502 Wed Aug 26 17:00:00 2026\n";
    });
    expect(() =>
      assertPersistentServerListenerOwned(fixture().servers[0]),
    ).toThrow("listener is foreign");
  });

  it("does not downgrade listener probe failures to clean residue", async () => {
    execFileSyncMock.mockImplementation(() => {
      throw Object.assign(new Error("lsof unavailable"), { status: 2 });
    });
    const kill = vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("gone"), { code: "ESRCH" });
    });
    try {
      await expect(
        waitForPersistentServerNoResidue(fixture().servers[0]),
      ).rejects.toThrow("lsof unavailable");
    } finally {
      kill.mockRestore();
    }
  });
});
