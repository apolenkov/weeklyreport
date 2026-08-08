import { describe, expect, it, vi } from "vitest";

import { captureFrozenRecoveryEvidence } from "./frozen-case-recovery-evidence.ts";

const harness = vi.hoisted(() => ({ collect: vi.fn() }));

vi.mock("../../evidence/server-log-evidence.ts", () => ({
  collectServerLogEvidence: harness.collect,
}));

vi.mock("../frozen-case-artifacts.ts", () => ({
  writeFrozenCaseArtifact: vi.fn(() =>
    Promise.resolve({
      artifactId: "recovery-ref",
      kind: "log",
      dimension: "runtime",
      archivePath: "/archive/recovery-evidence.json",
      digest: "a".repeat(64),
      capturedAt: "2026-08-08T00:00:01.000Z",
      cellId: "case-recovery",
      sourceSha: "a".repeat(40),
      profile: "minimal",
      role: "lead",
      catalogRoute: "/lead/report/[reportId]",
      resolvedRoute: "/lead/report/report-id",
    }),
  ),
}));

const input = {
  runtime: { archiveRoot: "/archive", apiLogPath: "/archive/app.log" },
  matrixCase: {
    caseId: "case-recovery",
    sourceSha: "a".repeat(40),
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report/[reportId]",
    resolvedRoute: "/lead/report/report-id",
  },
} as never;

const window = {
  startedAt: "2026-08-08T00:00:00.000Z",
  endedAt: "2026-08-08T00:00:01.000Z",
  records: {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    responses: [],
  },
  cursor: {
    consoleMessages: 0,
    pageErrors: 0,
    requestFailures: 0,
    responses: 0,
  },
} as const;

describe("frozen recovery evidence", () => {
  it.each([
    [0, "pass"],
    [1, "fail"],
  ] as const)(
    "maps %s slow recovery operations to %s",
    async (slow, outcome) => {
      harness.collect.mockResolvedValueOnce({
        available: true,
        records: [],
        malformedCount: 0,
        correlationIds: ["recovery"],
        missingCorrelationIds: [],
        errorCount: 0,
        warningCount: 0,
        slowCount: slow,
        workerCount: 0,
      });
      const evidence = await captureFrozenRecoveryEvidence(input, window, {
        status: "pass",
      });
      expect(evidence.observation).toMatchObject({
        observationId: "action-recovery",
        outcome,
        evidenceIds: ["recovery-ref"],
      });
    },
  );

  it("fails the observation when reset or baseline recovery fails", async () => {
    harness.collect.mockResolvedValueOnce({
      available: true,
      records: [],
      malformedCount: 0,
      correlationIds: [],
      missingCorrelationIds: [],
      errorCount: 0,
      warningCount: 0,
      slowCount: 0,
      workerCount: 0,
    });
    const evidence = await captureFrozenRecoveryEvidence(input, window, {
      status: "fail",
      reason: "baseline mismatch",
    });
    expect(evidence.observation).toMatchObject({
      observationId: "action-recovery",
      outcome: "fail",
    });
    expect(evidence.observation.message).toContain("Recovery fail");
  });
});
