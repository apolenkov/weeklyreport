import { stableSerialize } from "../../../support/ids.ts";
import type {
  RevealBranch,
  RevealCandidate,
} from "../interaction/preflight-reveal-branches.ts";
import { RevealContinuationReplayError } from "./preflight-reveal-continuation-errors.ts";
import type { RevealCandidateList } from "./preflight-reveal-continuation-schemas.ts";
import {
  candidateListDigestFor,
  revealCandidateIdentityFor,
} from "./receipts/preflight-reveal-continuation-receipt-assets.ts";

const representativeInputFor = (input: {
  readonly candidate: RevealCandidate;
  readonly recorded: RevealCandidateList["candidates"][number];
}) => {
  const expected = input.candidate.representativeInput ?? null;
  const actual = input.recorded.representativeInput;
  switch (input.candidate.action.operation) {
    case "select":
      if (
        actual?.kind !== "select" ||
        (expected !== null &&
          stableSerialize(expected) !== stableSerialize(actual))
      )
        throw new RevealContinuationReplayError(
          "R188 select candidate lacks its canonical frozen input",
        );
      return actual;
    case "fill":
      if (
        actual?.kind !== "fill" ||
        stableSerialize(expected) !== stableSerialize(actual)
      )
        throw new RevealContinuationReplayError(
          "R188 fill candidate representative input drifted",
        );
      return actual;
    default:
      if (actual !== null || expected !== null)
        throw new RevealContinuationReplayError(
          "R188 non-form candidate carries representative input",
        );
      return null;
  }
};

export const canonicalCandidatesForList = (input: {
  readonly branch: RevealBranch;
  readonly branchDigest: string;
  readonly candidates: readonly RevealCandidate[];
  readonly candidateList: RevealCandidateList;
  readonly candidateListDigest: string;
}): readonly RevealCandidate[] => {
  if (
    input.candidateList.branchDigest !== input.branchDigest ||
    input.candidateList.candidates.length !== input.candidates.length
  )
    throw new RevealContinuationReplayError(
      "R188 canonical candidate list branch or length drifted",
    );
  const canonical = input.candidates.map((candidate, index) => {
    const recorded = input.candidateList.candidates[index];
    if (
      recorded === undefined ||
      stableSerialize(recorded.action) !== stableSerialize(candidate.action)
    )
      throw new RevealContinuationReplayError(
        "R188 canonical candidate action or order drifted",
      );
    const representativeInput = representativeInputFor({
      candidate,
      recorded,
    });
    const canonicalCandidate: RevealCandidate = {
      ...candidate,
      ...(representativeInput === null ? {} : { representativeInput }),
    };
    if (
      revealCandidateIdentityFor({
        branch: input.branch,
        candidate: canonicalCandidate,
      }) !== recorded.candidateId
    )
      throw new RevealContinuationReplayError(
        "R188 canonical candidate identity drifted",
      );
    return canonicalCandidate;
  });
  if (
    candidateListDigestFor(
      input.candidateList.candidates.map(({ candidateId }) => candidateId),
    ) !== input.candidateListDigest
  )
    throw new RevealContinuationReplayError(
      "R188 canonical candidate list digest drifted",
    );
  return canonical;
};
