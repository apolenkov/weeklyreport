import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { BugsinkProjectCounters } from "../../preflight/observability/environment-observer-bugsink.ts";
import type { RuntimeLaneAssignment } from "../runtime-lane-contract.ts";
import type { RuntimeLaneRunIdentity } from "../runtime-lane-run-identity.ts";
import { writeRuntimeBugsinkRunEvidence } from "./runtime-bugsink-run-evidence.ts";

const SOURCE_SHA = "a".repeat(40);
const ASSIGNMENT_DIGEST = "b".repeat(64);
const RUN_ID = "00000000-0000-4000-8000-000000000001";

const assignmentFor = (sourceArchiveRoot: string): RuntimeLaneAssignment => ({
  artifact: "RUNTIME_LANE_ASSIGNMENT",
  version: 1,
  sourceSha: SOURCE_SHA,
  matrixDigest: "c".repeat(64),
  mode: "one-cell",
  sourceArchiveRoot,
  sourceArtifacts: {
    SOURCE: "d".repeat(64),
    PREFLIGHT: "e".repeat(64),
    MATRIX: "f".repeat(64),
    MANIFEST: "0".repeat(64),
  },
  profiles: ["minimal"],
  lanes: [
    {
      laneId: "a",
      databaseName: "customreport_e2e_lane_a_test",
      redisPort: 6381,
      apiPort: 3112,
      webPort: 3115,
      archiveRoot: path.join(sourceArchiveRoot, "lanes", "a"),
      groups: [{ profile: "minimal", caseIds: ["case-a"] }],
    },
  ],
  assignmentDigest: ASSIGNMENT_DIGEST,
});

const counters = (value: number): BugsinkProjectCounters => ({
  slug: "runtime-sweep",
  digested_event_count: value,
  stored_event_count: value,
});

const runFor = (assignment: RuntimeLaneAssignment): RuntimeLaneRunIdentity => ({
  artifact: "RUNTIME_LANE_RUN",
  version: 1,
  sourceSha: assignment.sourceSha,
  matrixDigest: assignment.matrixDigest,
  assignmentDigest: assignment.assignmentDigest,
  runId: RUN_ID,
  startedAt: "2026-08-07T00:00:00.000Z",
  laneIds: ["a"],
  profiles: ["minimal"],
});

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

const projectResponse = (value: number): Response =>
  new Response(JSON.stringify(counters(value)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const evidencePath = (root: string): string =>
  path.join(root, `OBSERVABILITY-BUGSINK-${ASSIGNMENT_DIGEST}.json`);

describe("runtime Bugsink run evidence", () => {
  it("passes when the dedicated project counters stay unchanged", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-bugsink-"));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(projectResponse(10)));
    const assignment = assignmentFor(root);

    await expect(
      writeRuntimeBugsinkRunEvidence({
        assignment,
        run: runFor(assignment),
        observability: config,
        baseline: counters(10),
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt: "2026-08-07T00:01:00.000Z",
        fetcher,
        wait: () => Promise.resolve(),
      }),
    ).resolves.toBeUndefined();

    const report = JSON.parse(await readFile(evidencePath(root), "utf8")) as {
      status: string;
      delta: { stored: number };
    };
    expect(report).toEqual(
      expect.objectContaining({
        status: "pass",
        delta: { digested: 0, stored: 0 },
      }),
    );
  });

  it("writes a fail artifact when Bugsink receives an event", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-bugsink-"));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(projectResponse(11)));
    const assignment = assignmentFor(root);

    await expect(
      writeRuntimeBugsinkRunEvidence({
        assignment,
        run: runFor(assignment),
        observability: config,
        baseline: counters(10),
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt: "2026-08-07T00:01:00.000Z",
        fetcher,
        wait: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/stored event count changed/u);

    const report = JSON.parse(await readFile(evidencePath(root), "utf8")) as {
      status: string;
    };
    expect(report.status).toBe("fail");
  });

  it("detects an event that arrives after the first unchanged poll", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-bugsink-"));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(projectResponse(10))
      .mockResolvedValueOnce(projectResponse(10))
      .mockImplementation(() => Promise.resolve(projectResponse(11)));
    const assignment = assignmentFor(root);

    await expect(
      writeRuntimeBugsinkRunEvidence({
        assignment,
        run: runFor(assignment),
        observability: config,
        baseline: counters(10),
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt: "2026-08-07T00:01:00.000Z",
        fetcher,
        wait: () => Promise.resolve(),
      }),
    ).rejects.toThrow(/stored event count changed/u);
  });
});
