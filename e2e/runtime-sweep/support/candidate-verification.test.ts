import { describe, expect, it, vi } from "vitest";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import type {
  EnvironmentFeedback,
  EnvironmentHit,
} from "../preflight/environment-feedback.ts";
import type { CoverageCell } from "../source/contracts.ts";
import {
  appendEnvironmentCandidates,
  CandidateVerificationError,
  type CandidateVerifier,
  parseCandidateVerification,
  verifyDriverCandidates,
} from "./candidate-verification.ts";

const sourceSha = "a".repeat(40);
const candidate = {
  candidateId: "candidate-1",
  cellId: "cell-1",
  kind: "console" as const,
  summary: "console error",
  evidenceRefs: ["console-evidence"],
};
const context = {
  sourceSha,
  profile: "minimal" as const,
  role: "lead" as const,
  repoRoot: "/repo",
};

const cells = (routes: readonly string[] = ["/lead/report"]): CoverageCell[] =>
  routes.map(
    (route, index) =>
      ({
        cellId: `cell-${index + 1}`,
        catalogRoute: route,
        resolvedRoute: route,
        action: { controlKey: `control-${index + 1}` },
      }) as CoverageCell,
  );

const feedback = (hits: readonly EnvironmentHit[]): EnvironmentFeedback => ({
  canary: { injected: true, detected: true },
  channels: [],
  blindChannels: [],
  hits,
  blockingReasons: [],
  clean: hits.length === 0,
});

const hit = (overrides: Partial<EnvironmentHit> = {}): EnvironmentHit => ({
  channel: "app-log",
  eventId: "event-1",
  timestamp: "2026-08-04T00:00:01.000Z",
  kind: "server",
  message: "server warning",
  evidenceRefs: ["api-log:1"],
  route: "/lead/report",
  cellId: "cell-1",
  ...overrides,
});

const reportWithCandidates = (
  candidates: readonly AiDriverReport["candidates"][number][],
): AiDriverReport => ({ candidates }) as AiDriverReport;

describe("runtime-sweep independent candidate verification", () => {
  it("keeps only independently confirmed candidates for adjudication", async () => {
    const result = await verifyDriverCandidates([candidate], context, () =>
      Promise.resolve({
        candidateId: "candidate-1",
        cellId: "cell-1",
        sourceSha,
        status: "confirmed" as const,
        verifierRef: "verifier-1",
        rationale: "source confirms the observed error",
      }),
    );

    expect(result.confirmed.map(({ candidate: value }) => value)).toEqual([
      candidate,
    ]);
    expect(result.dismissed).toEqual([]);
  });

  it("does not send dismissed observations into adjudication", async () => {
    const result = await verifyDriverCandidates([candidate], context, () =>
      Promise.resolve({
        candidateId: "candidate-1",
        cellId: "cell-1",
        sourceSha,
        status: "dismissed" as const,
        verifierRef: "verifier-1",
        rationale: "the error is an expected seed artifact",
      }),
    );

    expect(result.confirmed).toEqual([]);
    expect(result.dismissed).toHaveLength(1);
  });

  it("rejects stale and malformed verifier output", async () => {
    expect(() =>
      parseCandidateVerification(
        {
          candidateId: "candidate-1",
          cellId: "cell-1",
          sourceSha: "b".repeat(40),
          status: "confirmed",
          verifierRef: "verifier-1",
          rationale: "stale",
        },
        { candidate, ...context },
      ),
    ).toThrow(/source SHA is stale/iu);
    await expect(
      verifyDriverCandidates([candidate], context, () =>
        Promise.resolve("not-json"),
      ),
    ).rejects.toThrow(CandidateVerificationError);
  });

  it("fails closed when no explicit verifier is supplied", async () => {
    await expect(
      verifyDriverCandidates(
        [candidate],
        context,
        undefined as unknown as CandidateVerifier,
      ),
    ).rejects.toThrow();
  });

  it("preserves an interrupted verifier as unavailable instead of adjudicating", async () => {
    await expect(
      verifyDriverCandidates([candidate], context, () =>
        Promise.reject(new Error("session interrupted")),
      ),
    ).rejects.toThrow(/session interrupted/iu);
  });

  it("verifies candidates sequentially through an explicit verifier", async () => {
    const first = Promise.withResolvers<unknown>();
    const secondCandidate = {
      ...candidate,
      candidateId: "candidate-2",
    };
    const verifier = vi.fn<CandidateVerifier>((value) =>
      value.candidateId === candidate.candidateId
        ? first.promise
        : Promise.resolve({
            candidateId: secondCandidate.candidateId,
            cellId: secondCandidate.cellId,
            sourceSha,
            status: "dismissed" as const,
            verifierRef: "verifier-2",
            rationale: "independently dismissed",
          }),
    );
    const verification = verifyDriverCandidates(
      [candidate, secondCandidate],
      context,
      verifier,
    );

    await vi.waitFor(() => expect(verifier).toHaveBeenCalledTimes(1));
    first.resolve({
      candidateId: candidate.candidateId,
      cellId: candidate.cellId,
      sourceSha,
      status: "confirmed",
      verifierRef: "verifier-1",
      rationale: "independently confirmed",
    });
    await expect(verification).resolves.toMatchObject({
      verifications: [
        { candidateId: "candidate-1" },
        { candidateId: "candidate-2" },
      ],
    });
    expect(verifier).toHaveBeenCalledTimes(2);
  });

  it("fails closed when an environment hit has no route or cell mapping", () => {
    expect(() =>
      appendEnvironmentCandidates(
        reportWithCandidates([]),
        feedback([hit({ route: null, cellId: null })]),
        cells(),
      ),
    ).toThrow(/expected exactly one/iu);
  });

  it("fails closed when a route maps to multiple assigned cells", () => {
    expect(() =>
      appendEnvironmentCandidates(
        reportWithCandidates([]),
        feedback([hit({ route: "/shared", cellId: null })]),
        cells(["/shared", "/shared"]),
      ),
    ).toThrow(/expected exactly one/iu);
  });

  it("fails closed on environment candidate id collisions", () => {
    const existing = {
      ...candidate,
      candidateId: "environment-event-1",
    };

    expect(() =>
      appendEnvironmentCandidates(
        reportWithCandidates([existing]),
        feedback([hit()]),
        cells(),
      ),
    ).toThrow(/collides with an existing candidate/iu);
  });
});
