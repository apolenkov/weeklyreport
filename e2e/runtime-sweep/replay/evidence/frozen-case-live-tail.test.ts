import { expect, test, vi } from "vitest";

import { evidenceBundleSchema, type Oracle } from "../../source/contracts.ts";
import { replayFrozenCase } from "../frozen-case-evidence.ts";
import type { FrozenCaseLiveRuntime } from "../frozen-case-live-actions.ts";
import { matrixCase } from "../test-fixtures/frozen-case-live-runner.test-fixture.ts";
import { attachLateRuntimeEvents } from "./frozen-case-live-tail.ts";

vi.mock("../frozen-case-artifacts.ts", () => ({
  writeFrozenCaseArtifact: vi.fn(() =>
    Promise.resolve({
      artifactId: "late-runtime-events",
      kind: "log",
      dimension: "runtime",
      archivePath: "/archive/after/late-runtime-events.json",
      digest: "b".repeat(64),
      capturedAt: "2026-08-07T00:00:01.000Z",
      cellId: "case-rerender",
      sourceSha: "a".repeat(40),
      profile: "minimal",
      role: "lead",
      catalogRoute: "/lead/report",
      resolvedRoute: "/lead/report",
    }),
  ),
}));

const cleanBundle = () =>
  evidenceBundleSchema.parse({
    before: [],
    action: [],
    after: [],
    observations: [
      {
        observationId: "network",
        kind: "network",
        outcome: "pass",
        message: "Runtime network evidence is clean",
        evidenceIds: [],
      },
    ],
    inapplicable: [],
  });

const ORACLE: Oracle = {
  domainSpecRefs: ["openspec/specs/exhaustive-runtime-sweep/spec.md"],
  function: { required: true, expectation: "state matches" },
  accessibility: { required: true, expectation: "controls are usable" },
  visual: { required: true, expectation: "geometry is stable" },
};
const BUGSINK_DSN = "http://runtime@bugsink.test/1";
const runtime = {
  archiveRoot: "/archive",
  bugsinkDsn: BUGSINK_DSN,
} as FrozenCaseLiveRuntime;

test("turns a delayed after-phase transport failure into a non-pass cell", async () => {
  const after = await attachLateRuntimeEvents({
    matrixCase,
    runtime,
    bundle: cleanBundle(),
    records: {
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [
        {
          requestId: "late-product-request",
          url: "/trpc/report.read",
          method: "POST",
          resourceType: "fetch",
          failure: "net::ERR_ABORTED",
          startedAt: "2026-08-07T00:00:00.000Z",
          endedAt: "2026-08-07T00:00:01.000Z",
          durationMs: 1000,
        },
      ],
      responses: [],
    },
  });
  const result = replayFrozenCase(matrixCase, {
    caseId: matrixCase.caseId,
    oracle: ORACLE,
    controls: [],
    evidence: {
      before: cleanBundle(),
      action: cleanBundle(),
      after,
    },
  });

  expect(after.observations).toContainEqual(
    expect.objectContaining({ observationId: "network", outcome: "fail" }),
  );
  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    `${matrixCase.caseId} after observation network failed: Late network event detected after the after-phase snapshot`,
  );
});

test("keeps an exact late Sentry abort with a successful response as passing raw evidence", async () => {
  const url =
    "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0";
  const after = await attachLateRuntimeEvents({
    matrixCase,
    runtime,
    bundle: cleanBundle(),
    records: {
      consoleMessages: [],
      pageErrors: [],
      requestFailures: [
        {
          requestId: "late-sentry-request",
          url,
          method: "POST",
          resourceType: "fetch",
          failure: "net::ERR_ABORTED",
          startedAt: "2026-08-07T00:00:00.000Z",
          endedAt: "2026-08-07T00:00:01.000Z",
          durationMs: 1000,
        },
      ],
      responses: [
        {
          requestId: "late-sentry-request",
          url,
          method: "POST",
          resourceType: "fetch",
          status: 200,
          ok: true,
          startedAt: "2026-08-07T00:00:00.000Z",
          endedAt: "2026-08-07T00:00:01.000Z",
          durationMs: 1000,
          correlationId: null,
        },
      ],
    },
  });

  expect(after.after).toContainEqual(
    expect.objectContaining({ artifactId: "late-runtime-events" }),
  );
  expect(after.observations).toContainEqual(
    expect.objectContaining({ observationId: "network", outcome: "pass" }),
  );
  expect(after.observations[0]?.message).toContain(
    "1 late expected observability abort(s) ignored",
  );
});
