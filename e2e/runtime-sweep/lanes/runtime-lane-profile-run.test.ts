import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  RuntimeLane,
  RuntimeLaneAssignment,
} from "./runtime-lane-contract.ts";
import { runRuntimeLaneProfile } from "./runtime-lane-profile-run.ts";
import type { RuntimeLaneRunIdentity } from "./runtime-lane-run-identity.ts";

const observabilityHarness = vi.hoisted(() => ({
  reconcile: vi.fn(() => Promise.resolve()),
}));

vi.mock("./observability/runtime-profile-observability.ts", () => ({
  reconcileRuntimeProfileObservability: observabilityHarness.reconcile,
}));

const SOURCE_SHA = "a".repeat(40);
const DIGEST = "b".repeat(64);
const RUN_ID = "00000000-0000-4000-8000-000000000001";

const config = {
  otelEndpoint: "http://127.0.0.1:4318/",
  bugsink: {
    dsn: "http://key@127.0.0.1:8000/1",
    apiToken: "a".repeat(40),
  },
  loki: {
    pushUrl: "http://127.0.0.1:3100/loki/api/v1/push",
    queryUrl: "http://127.0.0.1:3100/loki/api/v1/query_range",
  },
} as const;

const laneFor = (archiveRoot: string): RuntimeLane => ({
  laneId: "a",
  databaseName: "customreport_e2e_lane_a_test",
  redisPort: 6381,
  apiPort: 3112,
  webPort: 3115,
  archiveRoot,
  groups: [{ profile: "minimal", caseIds: ["case-a"] }],
});

const identityFor = (
  lane: RuntimeLane,
): Readonly<{
  assignment: RuntimeLaneAssignment;
  run: RuntimeLaneRunIdentity;
}> => ({
  assignment: {
    artifact: "RUNTIME_LANE_ASSIGNMENT",
    version: 1,
    sourceSha: SOURCE_SHA,
    matrixDigest: DIGEST,
    mode: "one-cell",
    sourceArchiveRoot: path.dirname(lane.archiveRoot),
    sourceArtifacts: {
      SOURCE: DIGEST,
      PREFLIGHT: DIGEST,
      MATRIX: DIGEST,
      MANIFEST: DIGEST,
    },
    profiles: ["minimal"],
    lanes: [lane],
    assignmentDigest: DIGEST,
  },
  run: {
    artifact: "RUNTIME_LANE_RUN",
    version: 1,
    sourceSha: SOURCE_SHA,
    matrixDigest: DIGEST,
    assignmentDigest: DIGEST,
    runId: RUN_ID,
    startedAt: "2026-08-07T00:00:00.000Z",
    laneIds: ["a"],
    profiles: ["minimal"],
  },
});

describe("runtime lane profile run", () => {
  it("fails closed when execution rejects without a reason", async () => {
    const archiveRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-profile-run-"),
    );
    const lane = laneFor(archiveRoot);
    const identity = identityFor(lane);

    await expect(
      runRuntimeLaneProfile({
        lane,
        profile: "minimal",
        ...identity,
        observability: config,
        execute: () => Promise.reject(),
        abortExecution: vi.fn(),
      }),
    ).rejects.toThrow("rejected without a reason");
  });

  it("aborts siblings before observability reconciliation begins", async () => {
    const archiveRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-profile-abort-"),
    );
    const lane = laneFor(archiveRoot);
    const identity = identityFor(lane);
    const events: string[] = [];
    observabilityHarness.reconcile.mockImplementationOnce(() => {
      events.push("telemetry");
      return Promise.resolve();
    });

    await expect(
      runRuntimeLaneProfile({
        lane,
        profile: "minimal",
        ...identity,
        observability: config,
        execute: () => {
          events.push("execution-failed");
          return Promise.reject(new Error("child failed"));
        },
        abortExecution: () => events.push("siblings-aborted"),
      }),
    ).rejects.toThrow("child failed");

    expect(events).toEqual([
      "execution-failed",
      "siblings-aborted",
      "telemetry",
    ]);
  });
});
