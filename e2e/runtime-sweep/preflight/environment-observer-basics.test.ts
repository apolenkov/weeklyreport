import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import type { TranscriptToolRecord } from "../driver/driver-results-transcript.ts";
import { observeEnvironmentFeedback } from "./environment-observer.ts";

const report = (): AiDriverReport => ({
  provider: "native-codex",
  model: "gpt-5.6-luna",
  reasoning: "max",
  attemptId: "attempt-1",
  transcriptEvidence: {
    status: "captured",
    evidenceRefs: ["transcript:attempt-1"],
    digest: "a".repeat(64),
  },
  roleDriven: "lead",
  profile: "minimal",
  sourceSha: "a".repeat(40),
  assignedCells: [
    {
      cellId: "cell-report",
      catalogRoute: "/lead/report",
      resolvedRoute: "/lead/report",
      actionKey: "save",
    },
  ],
  routesVisited: 1,
  routesPlanned: 1,
  canary: { injected: true, detected: true },
  timeline: {
    startedAt: "2026-08-04T10:00:00.000Z",
    endedAt: "2026-08-04T10:05:00.000Z",
    routes: [
      {
        route: "/lead/report",
        enteredAt: "2026-08-04T10:00:00.000Z",
        leftAt: "2026-08-04T10:05:00.000Z",
      },
    ],
  },
  controlResults: [
    {
      cellId: "cell-report",
      controlKey: "save",
      status: "covered",
      result: "pass",
      evidenceRefs: ["save-evidence"],
    },
  ],
  candidates: [],
});

const transcriptRecords = [
  {
    attemptId: "attempt-1",
    timestamp: "2026-08-04T10:00:01.000Z",
    tool: "browser_console_messages",
    route: "/lead/report",
  },
  {
    attemptId: "attempt-1",
    timestamp: "2026-08-04T10:00:02.000Z",
    tool: "browser_network_requests",
    route: "/lead/report",
  },
] satisfies readonly TranscriptToolRecord[];

describe("runtime-sweep observer baseline states", () => {
  it("keeps unconfigured and unreadable channels blind", async () => {
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcriptRecords,
      apiLogPath: path.join(os.tmpdir(), "missing-runtime-observer.log"),
    });

    expect(feedback.blindChannels).toEqual(["app-log", "bugsink", "loki"]);
    expect(feedback.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "browser-console", status: "live" }),
        expect.objectContaining({ channel: "network", status: "live" }),
      ]),
    );
    expect(feedback.clean).toBe(false);
  });

  it("treats an empty readable API log as blind", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "runtime-observer-empty-log-"),
    );
    const apiLogPath = path.join(directory, "app.log");
    await writeFile(apiLogPath, " \n");
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcriptRecords,
      apiLogPath,
    });

    expect(feedback.blindChannels).toContain("app-log");
    expect(feedback.channels).toContainEqual({
      channel: "app-log",
      reachable: true,
      hasStreams: false,
      status: "blind",
      reason: "no shipped stream",
    });
    await rm(directory, { recursive: true, force: true });
  });

  it("does not let the console canary certify unobserved browser channels", async () => {
    const feedback = await observeEnvironmentFeedback({
      report: report(),
      transcriptRecords: [],
    });

    expect(feedback.blindChannels).toEqual([
      "browser-console",
      "network",
      "app-log",
      "bugsink",
      "loki",
    ]);
  });

  it("fails closed when a driver candidate has no unique route visit", async () => {
    const candidate = {
      candidateId: "console-missing",
      cellId: "cell-report",
      kind: "console" as const,
      summary: "console signal",
      evidenceRefs: ["candidate-evidence"],
    };
    const missingVisit = {
      ...report(),
      candidates: [candidate],
      timeline: { ...report().timeline, routes: [] },
    } as AiDriverReport;
    await expect(
      observeEnvironmentFeedback({
        report: missingVisit,
        transcriptRecords,
      }),
    ).rejects.toThrow(
      "driver candidate console-missing has no unique route visit",
    );

    const ambiguousVisit = {
      ...report(),
      candidates: [{ ...candidate, candidateId: "console-ambiguous" }],
      timeline: {
        ...report().timeline,
        routes: [...report().timeline.routes, report().timeline.routes[0]],
      },
    } as AiDriverReport;
    await expect(
      observeEnvironmentFeedback({
        report: ambiguousVisit,
        transcriptRecords,
      }),
    ).rejects.toThrow(
      "driver candidate console-ambiguous has no unique route visit",
    );
  });
});
