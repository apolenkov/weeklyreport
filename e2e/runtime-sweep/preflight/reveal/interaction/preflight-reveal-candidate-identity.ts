import { sha256Hex } from "../../../support/ids.ts";
import { canonicalRevealUrlFor } from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
} from "./preflight-reveal-branches.ts";

type BranchIdentity = Pick<RevealBranch, "path" | "surface" | "url">;
type CandidateIdentity = Pick<
  RevealCandidate,
  "action" | "representativeInput"
>;

const branchIdentityFor = (branch: BranchIdentity): string =>
  sha256Hex({
    path: branch.path.digest,
    surface: branch.surface.digest,
    url: canonicalRevealUrlFor(branch.url),
  });

export const revealCandidateIdentityFor = (input: {
  readonly branch: BranchIdentity;
  readonly candidate: CandidateIdentity;
}): string =>
  sha256Hex({
    branch: branchIdentityFor(input.branch),
    action: input.candidate.action,
    representativeInput: input.candidate.representativeInput ?? null,
  });

export const revealCandidateIdsFor = (
  branch: BranchIdentity,
  candidates: readonly RevealCandidate[],
): readonly string[] =>
  candidates.map((candidate) =>
    revealCandidateIdentityFor({ branch, candidate }),
  );
