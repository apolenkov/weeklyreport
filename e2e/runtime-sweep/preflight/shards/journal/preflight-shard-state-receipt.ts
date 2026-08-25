import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  parsePreflightSegmentArtifact,
  type PreflightSegmentArtifact,
  preflightSegmentForArtifact,
} from "../../journal/preflight-journal-artifact.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import {
  assertPreflightShardJournalContext,
  type PreflightShardJournalContext,
} from "./preflight-shard-journal-context.ts";
import {
  PreflightShardJournalError,
  type PreflightShardJournalIdentity,
  type PreflightShardJournalRecord,
} from "./preflight-shard-journal-contract.ts";
import {
  parsePreflightShardStateReceipt,
  PREFLIGHT_SHARD_STATE_RECEIPT,
  PREFLIGHT_SHARD_STATE_RECEIPT_VERSION,
  type PreflightShardStateReceipt,
} from "./preflight-shard-receipt-contract.ts";
import {
  assertExactPreflightShardArtifactPath,
  readCanonicalPreflightShardArtifact,
  writeCanonicalPreflightShardArtifact,
} from "./preflight-shard-receipt-io.ts";
import {
  preflightShardSegmentPathFor,
  preflightShardStateReceiptPathFor,
} from "./preflight-shard-receipt-paths.ts";

export type RevalidatedPreflightShardReceipt = Readonly<{
  readonly receipt: PreflightShardStateReceipt;
  readonly segmentArtifact: PreflightSegmentArtifact;
  readonly segment: MatrixPreflightSegment;
}>;

const stateFieldsFor = (state: PreflightShardState) => ({
  planIndex: state.planIndex,
  state: state.state,
  stateDigest: state.stateDigest,
  role: state.role,
  catalogRoute: state.catalogRoute,
  resolvedRoute: state.resolvedRoute,
  groupKey: state.groupKey,
});

const assignedStateFor = (
  context: PreflightShardJournalContext,
  candidate: PreflightShardState,
): PreflightShardState => {
  const assigned = context.shard.states.find(
    ({ state }) => state.stateId === candidate.state.stateId,
  );
  if (
    assigned === undefined ||
    stableSerialize(stateFieldsFor(assigned)) !==
      stableSerialize(stateFieldsFor(candidate))
  )
    throw new PreflightShardJournalError(
      `State ${candidate.state.stateId} is not exactly assigned to the shard`,
    );
  return assigned;
};

const identityMatches = (
  actual: PreflightShardJournalRecord | PreflightShardStateReceipt,
  expected: PreflightShardJournalIdentity,
): boolean =>
  (Object.keys(expected) as (keyof PreflightShardJournalIdentity)[]).every(
    (field) =>
      stableSerialize(actual[field]) === stableSerialize(expected[field]),
  );

const assertStartedBinding = (input: {
  readonly started: PreflightShardJournalRecord;
  readonly identity: PreflightShardJournalIdentity;
  readonly state: PreflightShardState;
}): void => {
  if (input.started.event !== "started" || input.started.status !== "STARTED")
    throw new PreflightShardJournalError(
      "Shard state receipt requires a STARTED journal record",
    );
  if (!identityMatches(input.started, input.identity))
    throw new PreflightShardJournalError(
      "STARTED journal record does not match the receipt context",
    );
  if (
    stableSerialize(stateFieldsFor(input.state)) !==
    stableSerialize(stateFieldsFor(input.started))
  )
    throw new PreflightShardJournalError(
      "STARTED journal record does not match the assigned state",
    );
};

const assertSegmentBinding = (input: {
  readonly artifact: PreflightSegmentArtifact;
  readonly context: PreflightShardJournalContext;
  readonly identity: PreflightShardJournalIdentity;
  readonly state: PreflightShardState;
}): void => {
  const sourceState = input.context.source.plan.states[input.state.planIndex];
  const artifact = input.artifact;
  const checks: readonly boolean[] = [
    sourceState?.stateId === input.state.state.stateId,
    artifact.sourceSha === input.identity.sourceSha,
    artifact.sourceTree === input.identity.sourceTree,
    artifact.treeDigest === input.identity.treeDigest,
    artifact.sourceDigest === input.identity.sourceDigest,
    artifact.planDigest === input.identity.planDigest,
    artifact.assignmentDigest === input.identity.assignmentDigest,
    stableSerialize(artifact.state) === stableSerialize(input.state.state),
    artifact.stateDigest === input.state.stateDigest,
    artifact.role === input.state.role,
    artifact.catalogRoute === input.state.catalogRoute,
    artifact.resolvedRoute === input.state.resolvedRoute,
    sourceState !== undefined &&
      stableSerialize(artifact.segment.state) === stableSerialize(sourceState),
  ];
  if (checks.some((matches) => !matches))
    throw new PreflightShardJournalError(
      `PREFLIGHT_SEGMENT does not match shard state ${input.state.state.stateId}`,
    );
};

const assertReceiptBinding = (input: {
  readonly receipt: PreflightShardStateReceipt;
  readonly identity: PreflightShardJournalIdentity;
  readonly state: PreflightShardState;
  readonly started: PreflightShardJournalRecord;
}): void => {
  const matches =
    identityMatches(input.receipt, input.identity) &&
    stableSerialize(stateFieldsFor(input.receipt)) ===
      stableSerialize(stateFieldsFor(input.state)) &&
    input.receipt.stateAttempt === input.started.attempt &&
    input.receipt.startedRecordDigest === input.started.recordDigest;
  if (!matches)
    throw new PreflightShardJournalError(
      `Shard receipt does not match ${input.state.state.stateId} attempt`,
    );
};

export const createPreflightShardStateReceipt = (input: {
  readonly context: PreflightShardJournalContext;
  readonly state: PreflightShardState;
  readonly started: PreflightShardJournalRecord;
  readonly segmentArtifactPath: string;
  readonly segmentArtifact: PreflightSegmentArtifact;
}): PreflightShardStateReceipt => {
  const identity = assertPreflightShardJournalContext(input.context);
  const state = assignedStateFor(input.context, input.state);
  assertStartedBinding({ started: input.started, identity, state });
  const expectedSegmentPath = preflightShardSegmentPathFor({
    context: input.context,
    state,
    attempt: input.started.attempt,
  });
  if (input.segmentArtifactPath !== expectedSegmentPath)
    throw new PreflightShardJournalError(
      "PREFLIGHT_SEGMENT path does not match the shard state attempt",
    );
  const artifact = parsePreflightSegmentArtifact(input.segmentArtifact);
  assertSegmentBinding({ artifact, context: input.context, identity, state });
  const body = {
    artifact: PREFLIGHT_SHARD_STATE_RECEIPT,
    version: PREFLIGHT_SHARD_STATE_RECEIPT_VERSION,
    ...identity,
    ...stateFieldsFor(state),
    stateAttempt: input.started.attempt,
    startedRecordDigest: input.started.recordDigest,
    segmentArtifactPath: input.segmentArtifactPath,
    segmentArtifactDigest: artifact.artifactDigest,
    segmentDigest: artifact.segmentDigest,
  } as const;
  return parsePreflightShardStateReceipt({
    ...body,
    receiptDigest: sha256Hex(body),
  });
};

const assertExactArchiveRoot = (
  context: PreflightShardJournalContext,
  archiveRoot: string,
): void => {
  if (archiveRoot !== context.resourceProof.resources.archiveRoot)
    throw new PreflightShardJournalError(
      "Shard receipt archive root does not match the resource proof",
    );
};

export const writePreflightShardStateReceipt = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly receipt: PreflightShardStateReceipt;
}): Promise<void> => {
  assertExactArchiveRoot(input.context, input.archiveRoot);
  const receipt = parsePreflightShardStateReceipt(input.receipt);
  const identity = assertPreflightShardJournalContext(input.context);
  if (!identityMatches(receipt, identity))
    throw new PreflightShardJournalError(
      "Shard receipt does not match the current journal context",
    );
  const state = assignedStateFor(input.context, receipt);
  if (
    input.filePath !==
    preflightShardStateReceiptPathFor({
      context: input.context,
      state,
      attempt: receipt.stateAttempt,
    })
  )
    throw new PreflightShardJournalError(
      "Shard receipt path does not match its state attempt",
    );
  assertExactPreflightShardArtifactPath(
    receipt.segmentArtifactPath,
    preflightShardSegmentPathFor({
      context: input.context,
      state,
      attempt: receipt.stateAttempt,
    }),
    "Shard receipt segment path does not match its state attempt",
  );
  await writeCanonicalPreflightShardArtifact({
    archiveRoot: input.archiveRoot,
    filePath: input.filePath,
    value: receipt,
  });
};

export const readPreflightShardStateReceipt = async (input: {
  readonly context: PreflightShardJournalContext;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly state: PreflightShardState;
  readonly started: PreflightShardJournalRecord;
}): Promise<RevalidatedPreflightShardReceipt> => {
  assertExactArchiveRoot(input.context, input.archiveRoot);
  const identity = assertPreflightShardJournalContext(input.context);
  const state = assignedStateFor(input.context, input.state);
  assertStartedBinding({ started: input.started, identity, state });
  const expectedReceiptPath = preflightShardStateReceiptPathFor({
    context: input.context,
    state,
    attempt: input.started.attempt,
  });
  if (input.filePath !== expectedReceiptPath)
    throw new PreflightShardJournalError(
      "Shard receipt path does not match the requested state attempt",
    );
  const receipt = parsePreflightShardStateReceipt(
    await readCanonicalPreflightShardArtifact({
      archiveRoot: input.archiveRoot,
      filePath: input.filePath,
    }),
  );
  assertReceiptBinding({ receipt, identity, state, started: input.started });
  assertExactPreflightShardArtifactPath(
    receipt.segmentArtifactPath,
    preflightShardSegmentPathFor({
      context: input.context,
      state,
      attempt: input.started.attempt,
    }),
    "Shard receipt segment path does not match its state attempt",
  );
  const artifact = parsePreflightSegmentArtifact(
    await readCanonicalPreflightShardArtifact({
      archiveRoot: input.archiveRoot,
      filePath: receipt.segmentArtifactPath,
    }),
  );
  assertSegmentBinding({ artifact, context: input.context, identity, state });
  if (
    artifact.artifactDigest !== receipt.segmentArtifactDigest ||
    artifact.segmentDigest !== receipt.segmentDigest
  )
    throw new PreflightShardJournalError(
      `Shard receipt has stale segment binding for ${state.state.stateId}`,
    );
  return {
    receipt,
    segmentArtifact: artifact,
    segment: preflightSegmentForArtifact(artifact),
  };
};
