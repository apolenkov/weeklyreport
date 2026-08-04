import { describe, expect, it, vi } from "vitest";

import {
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

  it("preserves an interrupted verifier as unavailable instead of adjudicating", async () => {
    await expect(
      verifyDriverCandidates([candidate], context, () =>
        Promise.reject(new Error("session interrupted")),
      ),
    ).rejects.toThrow(/session interrupted/iu);
  });

  it("verifies candidates sequentially to bound OpenCode sessions", async () => {
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
});
