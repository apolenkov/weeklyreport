import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { observabilityRelativePaths } from "./runtime-lane-observability-manifest.ts";
import {
  assignmentFor,
  logRecords,
  prepare,
  profile,
  rewriteProfileEvidence,
  RUN_ID,
  SOURCE_SHA,
  verificationDependencies,
  writeJson,
} from "./runtime-lane-observability-validation.test-fixture.ts";
import { verifyRuntimeLaneObservability } from "./runtime-lane-observability-validation.ts";

describe("runtime lane observability validation", () => {
  it("uses one canonical path order for a multi-profile lane", () => {
    const assignment = assignmentFor("/runtime");
    const lane = assignment.lanes[0];
    if (lane === undefined) throw new Error("Missing lane fixture");

    expect(
      observabilityRelativePaths({
        ...lane,
        groups: [
          { profile: "stress", caseIds: ["stress-case"] },
          { profile: "minimal", caseIds: ["minimal-case"] },
        ],
      }),
    ).toEqual([
      "OBSERVABILITY-READINESS.json",
      "observability/minimal.json",
      "observability/minimal-shutdown.json",
      "observability/stress.json",
      "observability/stress-shutdown.json",
    ]);
  });

  it("accepts assignment-bound readiness, Loki delivery, and Bugsink evidence", async () => {
    const prepared = await prepare("pass");

    const result = await verifyRuntimeLaneObservability(
      prepared.assignment,
      verificationDependencies(),
    );

    expect(result.runId).toBe(RUN_ID);
    expect(result.digest).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("rejects a failed profile observability artifact", async () => {
    const prepared = await prepare("fail");

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow(/inconsistent/u);
  });

  it("rejects a minimal loose pass object", async () => {
    const prepared = await prepare("pass");
    await writeFile(
      path.join(prepared.lane.archiveRoot, "observability", "minimal.json"),
      `${JSON.stringify({
        artifact: "RUNTIME_PROFILE_OBSERVABILITY",
        version: 1,
        sourceSha: SOURCE_SHA,
        laneId: "a",
        profile: "minimal",
        status: "pass",
        issues: [],
      })}\n`,
      "utf8",
    );

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow();
  });

  it("rejects evidence copied from another run id", async () => {
    const prepared = await prepare("pass");
    const profilePath = path.join(
      prepared.lane.archiveRoot,
      "observability",
      "minimal.json",
    );
    await writeJson(profilePath, {
      ...profile(prepared.assignment, "pass"),
      runId: "00000000-0000-4000-8000-000000000002",
    });

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow();
  });

  it("rejects a zero-log pass with a regenerated completion manifest", async () => {
    const prepared = await prepare("pass");
    await rewriteProfileEvidence(
      prepared,
      {
        ...profile(prepared.assignment, "pass"),
        appLog: { files: ["app.log"], records: 0, malformed: 0, counts: [] },
        loki: { records: 0, counts: [] },
        shutdownMarker: {
          message: "API shutdown log barrier reached",
          appLog: 0,
          loki: 0,
        },
      },
      [],
    );

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow(/inconsistent/u);
  });

  it("rejects equal local and Loki error counts declared as pass", async () => {
    const prepared = await prepare("pass");
    const errorCounts = [
      { correlationId: "corr-a", level: "error", count: 1 },
      { correlationId: "no-context", level: "info", count: 1 },
    ];
    await rewriteProfileEvidence(
      prepared,
      {
        ...profile(prepared.assignment, "pass"),
        appLog: {
          files: ["app.log"],
          records: 2,
          malformed: 0,
          counts: errorCounts,
        },
        loki: { records: 2, counts: errorCounts },
      },
      logRecords("error"),
    );

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow(/inconsistent/u);
  });

  it("rejects a missing terminal marker with a regenerated manifest", async () => {
    const prepared = await prepare("pass");
    const requestRecord = logRecords()[0];
    const requestCounts = [
      { correlationId: "corr-a", level: "info", count: 1 },
    ];
    await rewriteProfileEvidence(
      prepared,
      {
        ...profile(prepared.assignment, "pass"),
        appLog: {
          files: ["app.log"],
          records: 1,
          malformed: 0,
          counts: requestCounts,
        },
        loki: { records: 1, counts: requestCounts },
        shutdownMarker: {
          message: "API shutdown log barrier reached",
          appLog: 0,
          loki: 0,
        },
      },
      [requestRecord],
    );

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow(/inconsistent/u);
  });

  it("rejects matching declared Loki counts when the live query is empty", async () => {
    const prepared = await prepare("pass");
    await rewriteProfileEvidence(
      prepared,
      profile(prepared.assignment, "pass"),
      logRecords(),
    );

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies([], 0),
      ),
    ).rejects.toThrow(/inconsistent/u);
  });

  it("rejects API completion timestamped before the local shutdown barrier", async () => {
    const prepared = await prepare("pass");
    await rewriteProfileEvidence(
      prepared,
      profile(prepared.assignment, "pass"),
      logRecords(),
      "2026-08-07T00:00:19.000Z",
    );

    await expect(
      verifyRuntimeLaneObservability(
        prepared.assignment,
        verificationDependencies(),
      ),
    ).rejects.toThrow(/shutdown completion is inconsistent/u);
  });
});
