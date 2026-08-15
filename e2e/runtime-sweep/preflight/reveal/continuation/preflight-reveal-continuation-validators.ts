import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import {
  constantTimeEqualHex,
  grantDigestForBody,
  hmacFor,
  R188_DIGEST_LENGTH,
  R188_ZERO_DIGEST,
} from "./preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";
import type {
  RevealContinuationRoute,
  RevealExecutionGrant,
} from "./preflight-reveal-continuation-schemas.ts";
import { assertRunIdentityForGrant } from "./preflight-reveal-continuation-validators-receipts.ts";

export {
  assertReceiptChunkContract,
  assertReceiptContract,
} from "./preflight-reveal-continuation-validators-receipts.ts";

const digestError = (label: string): never => {
  throw new RevealContinuationError(
    `R188 ${label} digest does not match canonical contents`,
  );
};

const assertDigest = (
  label: string,
  actual: string,
  expected: string,
): void => {
  if (!constantTimeEqualHex(actual, expected)) digestError(label);
};

const assertRef = (label: string, value: string): void => {
  if (!new RegExp(`^[0-9a-f]{${String(R188_DIGEST_LENGTH)}}$`, "u").test(value))
    throw new RevealContinuationError(
      `R188 ${label} is not a content-addressed SHA-256 ref`,
    );
};

export const assertExecutionGrantContract = (
  grant: RevealExecutionGrant,
): void => {
  const { grantDigest: _grantDigest, ...body } = grant;
  assertDigest("execution grant", grantDigestForBody(body), grant.grantDigest);
  if (grant.authorityTag === R188_ZERO_DIGEST)
    throw new RevealContinuationError(
      "R188 execution grant must be parent-sealed",
    );
  for (const [label, value] of [
    ["chain.receiptHead", grant.chain.receiptHead],
    ["chain.chunkHead", grant.chain.chunkHead],
    ["genesis.inventoryRef", grant.genesis.inventoryRef],
    ["genesis.surfaceRef", grant.genesis.surfaceRef],
    ["genesis.pathNodeRef", grant.genesis.pathNodeRef],
    ["genesis.branchRef", grant.genesis.branchRef],
    ["genesis.candidateListRef", grant.genesis.candidateListRef],
    ["frontier.branchRef", grant.frontier.branchRef],
    ["frontier.pathNodeRef", grant.frontier.pathNodeRef],
    ["frontier.inventoryRef", grant.frontier.inventoryRef],
    ["frontier.surfaceRef", grant.frontier.surfaceRef],
    ["frontier.candidateListRef", grant.frontier.candidateListRef],
    ["frontier.nextCandidateId", grant.frontier.nextCandidateId],
    ["reducerStateDigest", grant.reducerStateDigest],
  ] as const) {
    if (value !== null) assertRef(label, value);
  }
  if (grant.frontier.nextCandidateIndex < 0)
    throw new RevealContinuationError("R188 grant frontier cursor is negative");
};

const assertParentGrantAuthority = (input: {
  readonly grant: RevealExecutionGrant;
  readonly authorityKey: string;
}): void => {
  assertExecutionGrantContract(input.grant);
  const { authorityTag, grantDigest: _grantDigest, ...rest } = input.grant;
  const expected = hmacFor(input.authorityKey, "execution-grant", {
    ...rest,
    authorityTag: R188_ZERO_DIGEST,
  });
  if (!constantTimeEqualHex(expected, authorityTag))
    throw new RevealContinuationError("R188 execution grant HMAC is invalid");
};

export const assertRevealExecutionGrantInput = (input: {
  readonly grant: RevealExecutionGrant;
  readonly expectedGrantDigest: string;
}): void => {
  assertExecutionGrantContract(input.grant);
  if (input.grant.grantDigest !== input.expectedGrantDigest)
    throw new RevealContinuationError(
      "R188 child grant digest does not match its parent grant",
    );
};

export const assertRevealExecutionGrantSource = (input: {
  readonly grant: RevealExecutionGrant;
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealContinuationRoute;
  readonly executionScope: "canary";
  readonly attemptId: string;
  readonly expectedGrantDigest?: string;
}): void => {
  assertRunIdentityForGrant({
    run: input.grant.run,
    source: input.source,
    state: input.state,
    route: input.route,
    attemptId: input.attemptId,
  });
  if (
    input.expectedGrantDigest !== undefined &&
    input.grant.grantDigest !== input.expectedGrantDigest
  )
    throw new RevealContinuationError(
      "R188 grant digest does not match parent expectation",
    );
};

export const assertRevealExecutionGrantAuthority = (input: {
  readonly grant: RevealExecutionGrant;
  readonly source: SourceArtifact;
  readonly authorityKey: string;
  readonly attemptId: string;
  readonly stateId: string;
  readonly role?: string;
  readonly route?: string;
  readonly profile?: CampaignMatrixState["profile"];
}): void => {
  assertParentGrantAuthority({
    grant: input.grant,
    authorityKey: input.authorityKey,
  });
  const run = input.grant.run;
  if (
    run.sourceSha !== input.source.sourceSha ||
    run.attemptId !== input.attemptId ||
    run.state.stateId !== input.stateId ||
    (input.role !== undefined && run.selector.role !== input.role) ||
    (input.route !== undefined && run.selector.route !== input.route) ||
    (input.profile !== undefined && run.selector.profile !== input.profile)
  )
    throw new RevealContinuationError("R188 parent grant identity is stale");
};
