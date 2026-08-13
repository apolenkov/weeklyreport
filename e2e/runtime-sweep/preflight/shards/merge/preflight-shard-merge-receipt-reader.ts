import * as path from "node:path";

import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { freezeDeep } from "../../../source/manifest-source.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import {
  assertPreflightMatchesSource,
  createPreflightArtifact,
  parsePreflightArtifact,
  type PreflightArtifact,
} from "../../artifacts/preflight-artifact.ts";
import { attachSpecializedDeclarations } from "../../execution/playwright-preflight-support.ts";
import {
  readPreflightShardCompletion,
  type RevalidatedPreflightShardCompletion,
} from "../completion/preflight-shard-completion-io.ts";
import { readPreflightShardJournal } from "../journal/preflight-shard-journal-io.ts";
import type { RevalidatedPreflightShardPass } from "../journal/preflight-shard-resume.ts";
import type {
  PreflightShard,
  PreflightShardAssignment,
} from "../preflight-shard-assignment.ts";
import type { PreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-contract.ts";
import { readPreflightShardResourceProof } from "../resources/preflight-shard-resource-proof-io.ts";
import {
  type PreflightShardResourceProofDonorRoot,
  validatePreflightShardResourceProofSet,
} from "../resources/preflight-shard-resource-proof-set-validation.ts";
import {
  assertPreflightShardResourceProofFilesystem,
  assertPreflightShardResourceProofMatchesSource,
} from "../resources/preflight-shard-resource-proof-validation.ts";
import { assertExactSourceStateUnion } from "./preflight-shard-merge-assembly.ts";
import {
  assertPreflightShardMergeReceiptMatchesSource,
  parsePreflightShardMergeReceipt,
  PreflightShardMergeError,
  type PreflightShardMergeReceipt,
} from "./preflight-shard-merge-contract.ts";

const equal = (left: unknown, right: unknown): boolean =>
  stableSerialize(left) === stableSerialize(right);
const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
// prettier-ignore
const keyFor = (value: { donorId: string; logicalShardId: string; shardAttemptId: string }): string =>
  [value.donorId, value.logicalShardId, value.shardAttemptId].join("\u0000");

// prettier-ignore
export type PreflightShardMergeReceiptTrustedBinding = Readonly<{ donorId: string; donorRoot: string; logicalShardId: string; shardAttemptId: string; archiveRoot: string; resourceProofPath: string; completionPath: string; journalPath: string }>;
// prettier-ignore
type Input = Readonly<{ source: SourceArtifact; assignment: PreflightShardAssignment; preflight: PreflightArtifact; receipt: PreflightShardMergeReceipt; donorRoots: readonly PreflightShardResourceProofDonorRoot[]; trustedBindings: readonly PreflightShardMergeReceiptTrustedBinding[] }>;
// prettier-ignore
type Snapshot = readonly [PreflightShardResourceProof, Awaited<ReturnType<typeof readPreflightShardCompletion>>["completion"], readonly unknown[], readonly unknown[]];
// prettier-ignore
type Collection = readonly [readonly Snapshot[], readonly MatrixPreflightSegment[]];

// prettier-ignore
const canonicalPath = (binding: PreflightShardMergeReceiptTrustedBinding, fileName: string): string => path.join(binding.archiveRoot, "shards", binding.logicalShardId, "attempts", binding.shardAttemptId, fileName);

const bindingFor = (
  shard: PreflightShardMergeReceipt["shards"][number],
  bindings: readonly PreflightShardMergeReceiptTrustedBinding[],
): PreflightShardMergeReceiptTrustedBinding => {
  const binding = bindings.find(
    (candidate) => keyFor(candidate) === keyFor(shard),
  );
  if (binding === undefined)
    throw new PreflightShardMergeError(
      `No trusted archive binding exists for ${keyFor(shard)}`,
    );
  if (
    path.resolve(binding.archiveRoot) !== binding.archiveRoot ||
    path.resolve(binding.archiveRoot) ===
      path.parse(binding.archiveRoot).root ||
    shard.donorRoot !== binding.donorRoot ||
    binding.resourceProofPath !==
      canonicalPath(binding, "PREFLIGHT_SHARD_RESOURCE_PROOF.json") ||
    binding.completionPath !== canonicalPath(binding, "SHARD_COMPLETE.json") ||
    binding.journalPath !==
      canonicalPath(binding, "PREFLIGHT_SHARD.journal.jsonl") ||
    shard.resourceProofPath !== binding.resourceProofPath ||
    shard.completionPath !== binding.completionPath ||
    shard.journalPath !== binding.journalPath
  )
    throw new PreflightShardMergeError(
      `Receipt paths do not match the trusted canonical archive binding for ${keyFor(shard)}`,
    );
  return binding;
};

const assertBindings = (
  receipt: PreflightShardMergeReceipt,
  bindings: readonly PreflightShardMergeReceiptTrustedBinding[],
): void => {
  if (
    bindings.length !== receipt.shards.length ||
    new Set(bindings.map(keyFor)).size !== bindings.length
  )
    throw new PreflightShardMergeError(
      "Trusted archive bindings must cover every receipt composite attempt exactly once",
    );
  receipt.shards.forEach((shard) => bindingFor(shard, bindings));
};

const proofFor = async (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightShardAssignment;
  readonly shard: PreflightShard;
  readonly receiptShard: PreflightShardMergeReceipt["shards"][number];
  readonly binding: PreflightShardMergeReceiptTrustedBinding;
}): Promise<PreflightShardResourceProof> => {
  try {
    const proof = await readPreflightShardResourceProof(
      input.binding.resourceProofPath,
      input.binding.archiveRoot,
    );
    await assertPreflightShardResourceProofFilesystem(proof);
    if (
      proof.donorId !== input.receiptShard.donorId ||
      proof.donorRoot !== input.binding.donorRoot ||
      proof.logicalShardId !== input.receiptShard.logicalShardId ||
      proof.shardAttemptId !== input.receiptShard.shardAttemptId ||
      proof.shardIndex !== input.receiptShard.shardIndex ||
      proof.shardDigest !== input.receiptShard.shardDigest ||
      proof.proofDigest !== input.receiptShard.resourceProofDigest ||
      proof.resources.archiveRoot !== input.binding.archiveRoot
    )
      throw new PreflightShardMergeError(
        `Durable merge receipt resource proof identity drifted for ${input.receiptShard.logicalShardId}`,
      );
    assertPreflightShardResourceProofMatchesSource({
      source: input.source,
      assignment: input.assignment,
      proof,
      selectedShard: input.shard,
    });
    return proof;
  } catch (error: unknown) {
    if (error instanceof PreflightShardMergeError) throw error;
    throw new PreflightShardMergeError(
      `Durable merge receipt resource proof read failed for ${input.receiptShard.logicalShardId}: ${message(error)}`,
    );
  }
};

const assertCompletion = (input: {
  readonly context: {
    readonly assignment: PreflightShardAssignment;
    readonly shard: PreflightShard;
  };
  readonly shard: PreflightShardMergeReceipt["shards"][number];
  readonly binding: PreflightShardMergeReceiptTrustedBinding;
  readonly value: RevalidatedPreflightShardCompletion;
}): void => {
  const c = input.value.completion;
  const states = input.context.shard.states;
  // prettier-ignore
  const actual = [c.logicalShardId, c.shardIndex, c.shardDigest, c.assignmentDigest, c.resourceProofDigest, c.archiveRoot, c.journalPath, c.journalRecordCount, c.journalTailDigest, c.completionDigest, c.assignedStateIds, c.assignedStateDigests, c.stateEvidence.map(({ stateId }) => stateId), c.stateEvidence.map(({ stateDigest }) => stateDigest)];
  // prettier-ignore
  const expected = [input.shard.logicalShardId, input.shard.shardIndex, input.shard.shardDigest, input.context.assignment.assignmentDigest, input.shard.resourceProofDigest, input.binding.archiveRoot, input.binding.journalPath, input.shard.journalRecordCount, input.shard.journalTailDigest, input.shard.completionDigest, input.shard.assignedStateIds, input.shard.assignedStateDigests, states.map(({ state }) => state.stateId), states.map(({ stateDigest }) => stateDigest)];
  if (!equal(actual, expected))
    throw new PreflightShardMergeError(
      `Durable merge receipt completion, journal, or ordered state binding drifted for ${input.shard.logicalShardId}`,
    );
};

const statesFor = (input: {
  readonly shard: PreflightShard;
  readonly passes: ReadonlyMap<string, RevalidatedPreflightShardPass>;
  readonly segments: Map<string, MatrixPreflightSegment>;
}): readonly unknown[] =>
  input.shard.states.map(({ state }) => {
    const pass = input.passes.get(state.stateId);
    if (pass === undefined || input.segments.has(state.stateId))
      throw new PreflightShardMergeError(
        `${pass === undefined ? "Missing" : "Duplicate"} durable terminal state ${state.stateId}`,
      );
    input.segments.set(state.stateId, pass.segment);
    return { stateId: state.stateId, ...pass };
  });

const collectOnce = async (
  input: Input & { readonly receipt: PreflightShardMergeReceipt },
): Promise<Collection> => {
  const proofs: PreflightShardResourceProof[] = [];
  const snapshots: Snapshot[] = [];
  const segments = new Map<string, MatrixPreflightSegment>();
  for (const [index, shardReceipt] of input.receipt.shards.entries()) {
    const shard = input.assignment.shards[index];
    if (shard === undefined)
      throw new PreflightShardMergeError(
        `Receipt shard ${index} is outside the assignment`,
      );
    const binding = bindingFor(shardReceipt, input.trustedBindings);
    const proof = await proofFor({
      source: input.source,
      assignment: input.assignment,
      shard,
      receiptShard: shardReceipt,
      binding,
    });
    const context = {
      source: input.source,
      assignment: input.assignment,
      shard,
      resourceProof: proof,
    };
    const value = await readPreflightShardCompletion({
      context,
      archiveRoot: binding.archiveRoot,
      filePath: binding.completionPath,
      journalPath: binding.journalPath,
    });
    assertCompletion({
      context,
      shard: shardReceipt,
      binding,
      value,
    });
    const journal = await readPreflightShardJournal({
      context,
      archiveRoot: binding.archiveRoot,
      filePath: binding.journalPath,
    });
    proofs.push(proof);
    snapshots.push([
      proof,
      value.completion,
      journal,
      statesFor({
        shard,
        passes: value.resume.terminalPasses,
        segments,
      }),
    ]);
  }
  validatePreflightShardResourceProofSet(proofs, {
    donorRoots: input.donorRoots,
    source: input.source,
    assignment: input.assignment,
  });
  return [
    snapshots,
    assertExactSourceStateUnion({ source: input.source, segments }),
  ];
};

/** Revalidates a receipt against two complete durable evidence snapshots. */
export const readPreflightShardMergeReceipt = async (
  input: Input,
): Promise<PreflightShardMergeReceipt> => {
  const preflight = (() => {
    try {
      return parsePreflightArtifact(input.preflight);
    } catch (error: unknown) {
      throw new PreflightShardMergeError(
        `Supplied PREFLIGHT is not canonical: ${message(error)}`,
      );
    }
  })();
  const receipt = parsePreflightShardMergeReceipt(input.receipt);
  assertBindings(receipt, input.trustedBindings);
  assertPreflightShardMergeReceiptMatchesSource({
    source: input.source,
    assignment: input.assignment,
    donorRoots: input.donorRoots,
    preflight,
    receipt,
  });
  const first = await collectOnce({ ...input, preflight, receipt });
  const second = await collectOnce({ ...input, preflight, receipt });
  if (!equal(first[0], second[0]) || !equal(first[1], second[1]))
    throw new PreflightShardMergeError(
      "Durable merge receipt evidence drifted between complete snapshot collections",
    );
  const reconstructed = createPreflightArtifact({
    source: input.source,
    segments: attachSpecializedDeclarations(input.source, first[1]),
  });
  assertPreflightMatchesSource(input.source, reconstructed);
  if (!equal(preflight, reconstructed))
    throw new PreflightShardMergeError(
      "Supplied PREFLIGHT does not match the reconstructed durable terminal segments",
    );
  return freezeDeep(receipt);
};

export const validatePreflightShardMergeReceipt =
  readPreflightShardMergeReceipt;
