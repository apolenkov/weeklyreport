import { describe, expect, it, vi } from "vitest";

import type { RequestFailureRecord } from "../../evidence/evidence-types.ts";
import type { FrozenRuntimeEvidenceWindow } from "./frozen-case-recovery-boundary.ts";
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
  runtime: {
    archiveRoot: "/archive",
    apiLogPath: "/archive/app.log",
    bugsinkDsn: "http://runtime@bugsink.test/1",
  },
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

const requestFailure = (
  overrides: Partial<RequestFailureRecord> = {},
): RequestFailureRecord => ({
  requestId: "recovery-sentry-request",
  url: "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0",
  method: "POST",
  resourceType: "fetch",
  failure: "net::ERR_ABORTED",
  startedAt: "2026-08-08T00:00:00.000Z",
  endedAt: "2026-08-08T00:00:00.001Z",
  durationMs: 1,
  ...overrides,
});

const windowWithFailure = (
  failure: RequestFailureRecord,
  responses: FrozenRuntimeEvidenceWindow["records"]["responses"] = [],
): FrozenRuntimeEvidenceWindow => ({
  ...window,
  records: { ...window.records, requestFailures: [failure], responses },
});

const successfulResponseFor = (
  failure: RequestFailureRecord,
): FrozenRuntimeEvidenceWindow["records"]["responses"][number] => ({
  requestId: failure.requestId,
  url: failure.url,
  method: failure.method,
  resourceType: failure.resourceType,
  status: 200,
  ok: true,
  startedAt: failure.startedAt,
  endedAt: failure.endedAt,
  durationMs: failure.durationMs,
  correlationId: null,
});

const responseFor = (
  status: number,
): FrozenRuntimeEvidenceWindow["records"]["responses"][number] => ({
  requestId: `recovery-response-${status}`,
  url: "http://runtime.test/trpc/report.get",
  method: "GET",
  resourceType: "fetch",
  status,
  ok: status >= 200 && status < 300,
  startedAt: "2026-08-08T00:00:00.000Z",
  endedAt: "2026-08-08T00:00:00.001Z",
  durationMs: 1,
  correlationId: null,
});

const cleanServerLogs = {
  available: true,
  records: [],
  malformedCount: 0,
  correlationIds: [],
  missingCorrelationIds: [],
  errorCount: 0,
  warningCount: 0,
  slowCount: 0,
  workerCount: 0,
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

  it("ignores an expected observability abort in recovery failure count", async () => {
    harness.collect.mockResolvedValueOnce(cleanServerLogs);
    const failure = requestFailure();
    const evidence = await captureFrozenRecoveryEvidence(
      input,
      windowWithFailure(failure, [successfulResponseFor(failure)]),
      { status: "pass" },
    );

    expect(evidence.observation).toMatchObject({ outcome: "pass" });
    expect(evidence.observation.message).toContain(
      "1 expected observability abort(s) ignored",
    );
  });

  it("keeps a non-envelope abort as a recovery failure", async () => {
    harness.collect.mockResolvedValueOnce(cleanServerLogs);
    const evidence = await captureFrozenRecoveryEvidence(
      input,
      windowWithFailure(requestFailure({ url: "/trpc/report.get" })),
      { status: "pass" },
    );

    expect(evidence.observation).toMatchObject({ outcome: "fail" });
    expect(evidence.observation.message).toContain(
      "1 unexpected request failure(s)",
    );
  });

  it("allows a 304 cache revalidation response during recovery", async () => {
    harness.collect.mockResolvedValueOnce(cleanServerLogs);
    const evidence = await captureFrozenRecoveryEvidence(
      input,
      {
        ...window,
        records: { ...window.records, responses: [responseFor(304)] },
      },
      { status: "pass" },
    );

    expect(evidence.observation).toMatchObject({ outcome: "pass" });
    expect(evidence.observation.message).toContain(
      "0 unexpected HTTP error response(s)",
    );
  });

  it("fails recovery for an HTTP error response", async () => {
    harness.collect.mockResolvedValueOnce(cleanServerLogs);
    const evidence = await captureFrozenRecoveryEvidence(
      input,
      {
        ...window,
        records: { ...window.records, responses: [responseFor(400)] },
      },
      { status: "pass" },
    );

    expect(evidence.observation).toMatchObject({ outcome: "fail" });
    expect(evidence.observation.message).toContain(
      "1 unexpected HTTP error response(s)",
    );
  });
});
