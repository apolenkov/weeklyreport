import type { CampaignMatrixState } from "../../../matrix/campaign-matrix.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  chunkDigestForBody,
  constantTimeEqualHex,
  R188_DIGEST_LENGTH,
  receiptDigestForBody,
} from "./preflight-reveal-continuation-digests.ts";
import { RevealContinuationError } from "./preflight-reveal-continuation-errors.ts";
import {
  type RevealContinuationReceipt,
  type RevealContinuationRoute,
  type RevealReceiptChunk,
} from "./preflight-reveal-continuation-schemas.ts";

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

const assertRunIdentity = (input: {
  readonly run: {
    readonly campaignId: string;
    readonly sourceSha: string;
    readonly sourceTree: string;
    readonly treeDigest: string;
    readonly sourceDigest: string;
    readonly planDigest: string;
    readonly state: CampaignMatrixState;
    readonly stateDigest: string;
    readonly selector: unknown;
    readonly selectorDigest: string;
    readonly route: RevealContinuationRoute;
    readonly routeDigest: string;
    readonly attemptId: string;
  };
  readonly source: SourceArtifact;
  readonly state: CampaignMatrixState;
  readonly route: RevealContinuationRoute;
  readonly attemptId: string;
}): void => {
  const run = input.run;
  if (
    run.campaignId !== input.source.campaignId ||
    run.sourceSha !== input.source.sourceSha ||
    run.sourceTree !== input.source.sourceTree ||
    run.treeDigest !== input.source.treeDigest ||
    run.sourceDigest !== input.source.sourceDigest ||
    run.planDigest !== input.source.plan.digest ||
    run.attemptId !== input.attemptId
  )
    throw new RevealContinuationError(
      "R188 execution grant source or attempt identity is stale",
    );
  if (
    sha256Hex(run.state) !== run.stateDigest ||
    sha256Hex(run.selector) !== run.selectorDigest ||
    sha256Hex(run.route) !== run.routeDigest
  )
    digestError("run identity");
  if (
    stableSerialize(run.state) !== stableSerialize(input.state) ||
    stableSerialize(run.route) !== stableSerialize(input.route)
  )
    throw new RevealContinuationError(
      "R188 execution grant state or route binding drifted",
    );
  const expectedSelector = {
    stateId: input.state.stateId,
    role: input.route.role,
    route: input.route.catalogRoute,
    profile: input.state.profile,
  };
  if (stableSerialize(run.selector) !== stableSerialize(expectedSelector))
    throw new RevealContinuationError(
      "R188 execution grant selector is not source-derived",
    );
};

const assertRef = (label: string, value: string): void => {
  if (!new RegExp(`^[0-9a-f]{${String(R188_DIGEST_LENGTH)}}$`, "u").test(value))
    throw new RevealContinuationError(
      `R188 ${label} is not a content-addressed SHA-256 ref`,
    );
};

export const assertReceiptContract = (
  receipt: RevealContinuationReceipt,
): void => {
  const { digest: _digest, ...body } = receipt;
  assertDigest("terminal receipt", receiptDigestForBody(body), receipt.digest);
  for (const [label, value] of [
    ["branchRef", receipt.branchRef],
    ["branchDigest", receipt.branchDigest],
    ["terminalBranchRef", receipt.terminal.terminalBranchRef],
    ["pathNodeRef", receipt.pathNodeRef],
    ["pathDigest", receipt.pathDigest],
    ["candidateListRef", receipt.candidateListRef],
    ["candidateListDigest", receipt.candidateListDigest],
    ["postActionInventoryRef", receipt.terminal.postActionInventoryRef],
    ["postActionInventoryDigest", receipt.terminal.postActionInventoryDigest],
    ["terminal.pathNodeRef", receipt.terminal.pathNodeRef],
    ["terminal.pathDigest", receipt.terminal.pathDigest],
    ["terminal.surfaceRef", receipt.terminal.surfaceRef],
    ["terminal.surfaceDigest", receipt.terminal.surfaceDigest],
  ] as const)
    assertRef(label, value);
  if (
    stableSerialize(receipt.transition.action) !==
      stableSerialize(receipt.action) ||
    stableSerialize(receipt.transition.representativeInput) !==
      stableSerialize(receipt.representativeInput) ||
    receipt.transition.afterSurfaceDigest !== receipt.terminal.surfaceDigest ||
    receipt.transition.afterUrl !== receipt.terminal.url ||
    stableSerialize(receipt.transition.nonMutation) !==
      stableSerialize(receipt.terminal.nonMutation)
  )
    throw new RevealContinuationError(
      "R188 terminal receipt action/result binding drifted",
    );
  if (
    receipt.terminal.enqueuedBranchRef !== null &&
    !/^[0-9a-f]{64}$/u.test(receipt.terminal.enqueuedBranchRef)
  )
    throw new RevealContinuationError(
      "R188 enqueued branch reference is invalid",
    );
  if (receipt.completedCandidateCount < receipt.sequence)
    throw new RevealContinuationError(
      "R188 completed candidate count regressed",
    );
};

export const assertReceiptChunkContract = (chunk: RevealReceiptChunk): void => {
  const { chunkDigest: _chunkDigest, ...body } = chunk;
  assertDigest("receipt chunk", chunkDigestForBody(body), chunk.chunkDigest);
  if (chunk.receipts.length === 0)
    throw new RevealContinuationError(
      "R188 child chunk must be a nonempty raw suffix",
    );
  for (const [index, receipt] of chunk.receipts.entries()) {
    const predecessor =
      index === 0
        ? chunk.predecessorReceiptHead
        : (chunk.receipts.at(index - 1)?.digest ?? null);
    assertReceiptContract(receipt);
    if (
      receipt.sequence !== chunk.predecessorReceiptCount + index + 1 ||
      receipt.predecessorDigest !== predecessor
    )
      throw new RevealContinuationError(
        "R188 receipt suffix sequence or predecessor is not contiguous",
      );
  }
  const last = chunk.receipts.at(-1);
  if (
    last?.digest !== chunk.receiptHead ||
    chunk.receiptCount !==
      chunk.predecessorReceiptCount + chunk.receipts.length ||
    chunk.chunkSequence !== chunk.predecessorChunkCount + 1
  )
    throw new RevealContinuationError(
      "R188 receipt chunk head/count/sequence is invalid",
    );
};

export const assertRunIdentityForGrant = assertRunIdentity;
