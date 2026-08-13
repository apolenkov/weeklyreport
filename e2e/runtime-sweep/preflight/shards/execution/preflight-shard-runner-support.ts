import type { MatrixPreflightSegment } from "../../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../../source/source-artifact.ts";
import { stableSerialize } from "../../../support/ids.ts";
import type { BrowserPreflightSegmentResult } from "../../execution/playwright-preflight.ts";
import type { PreflightRoute } from "../../execution/playwright-preflight-support.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "../../journal/preflight-journal-artifact.ts";
import {
  errorMessage,
  PreflightStateAmbiguousError,
} from "../../journal/preflight-journal-runner-support.ts";
import { redact } from "../../observability/environment-observer-events.ts";
import { assertPreflightArchivePath } from "../../preflight-archive-path.ts";
import { preflightSessionGroupKey } from "../../runtime/preflight-session.ts";
import {
  appendPreflightShardJournalStarted,
  appendPreflightShardJournalTerminal,
} from "../journal/preflight-shard-journal-io.ts";
import {
  preflightShardSegmentPathFor,
  preflightShardStateReceiptPathFor,
} from "../journal/preflight-shard-receipt-paths.ts";
import {
  createPreflightShardStateReceipt,
  writePreflightShardStateReceipt,
} from "../journal/preflight-shard-state-receipt.ts";
import type { PreflightShardState } from "../preflight-shard-assignment.ts";
import type { PreflightShardRunnerInput } from "./preflight-shard-runner.ts";

export class PreflightShardRunnerError extends Error {
  override readonly name = "PreflightShardRunnerError";
}

const segmentForResult = (
  result: MatrixPreflightSegment | BrowserPreflightSegmentResult,
): MatrixPreflightSegment => ("segment" in result ? result.segment : result);

const preparedGroupForResult = (
  result: MatrixPreflightSegment | BrowserPreflightSegmentResult,
  expectedGroup: string,
): string => {
  const preparedGroup =
    "segment" in result ? result.preparedGroup : expectedGroup;
  if (preparedGroup !== expectedGroup)
    throw new PreflightShardRunnerError(
      `Shard state runner prepared ${preparedGroup}, expected ${expectedGroup}`,
    );
  return preparedGroup;
};

const assertStateResult = (
  expected: SourceArtifact["plan"]["states"][number],
  segment: MatrixPreflightSegment,
): void => {
  if (segment.state.stateId !== expected.stateId)
    throw new PreflightShardRunnerError(
      `Shard state runner returned ${segment.state.stateId} for ${expected.stateId}`,
    );
  if (segment.state.pairwiseDigest !== expected.pairwiseDigest)
    throw new PreflightShardRunnerError(
      `Shard state runner returned a digest-drifted state ${expected.stateId}`,
    );
  if (stableSerialize(segment.state) !== stableSerialize(expected))
    throw new PreflightShardRunnerError(
      `Shard state runner returned a payload-drifted state ${expected.stateId}`,
    );
};

const statusForError = (error: unknown): "FAIL" | "AMBIGUOUS" =>
  error instanceof PreflightStateAmbiguousError ? "AMBIGUOUS" : "FAIL";

const failureSummaryFor = (error: unknown): string =>
  redact(errorMessage(error)) || "Unknown preflight shard failure";

const appendFailureAndStop = async (input: {
  readonly runner: PreflightShardRunnerInput;
  readonly state: PreflightShardState;
  readonly error: unknown;
  readonly assertBoundary: (runner: PreflightShardRunnerInput) => Promise<void>;
}): Promise<never> => {
  const status = statusForError(input.error);
  const failureSummary = failureSummaryFor(input.error);
  // A source-boundary failure is itself a terminal state outcome. Rechecking
  // the boundary is still required, but it must not prevent durable failure
  // evidence from replacing the STARTED record.
  try {
    await input.assertBoundary(input.runner);
  } catch {
    // The failure boundary remains terminally unqualified, but its journal
    // record still needs to replace STARTED below.
  }
  try {
    await appendPreflightShardJournalTerminal({
      context: input.runner.context,
      archiveRoot: input.runner.archiveRoot,
      filePath: input.runner.journalPath,
      status,
      failureSummary,
    });
  } catch (appendError: unknown) {
    throw new PreflightShardRunnerError(
      `Shard state ${input.state.state.stateId} failed with ${failureSummary}; terminal journal append failed with ${failureSummaryFor(appendError)}`,
    );
  }
  try {
    await input.assertBoundary(input.runner);
  } catch {
    // The terminal record is durable; the original failure remains the
    // caller-visible outcome and the next run will re-prove its source.
  }
  throw input.error;
};

const writeAttemptEvidence = async (input: {
  readonly runner: PreflightShardRunnerInput;
  readonly assigned: PreflightShardState;
  readonly started: Awaited<
    ReturnType<typeof appendPreflightShardJournalStarted>
  >;
  readonly sourceState: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly segment: MatrixPreflightSegment;
  readonly assertBoundary: (runner: PreflightShardRunnerInput) => Promise<void>;
}): Promise<string> => {
  const segmentArtifactPath = preflightShardSegmentPathFor({
    context: input.runner.context,
    state: input.assigned,
    attempt: input.started.attempt,
  });
  const receiptPath = preflightShardStateReceiptPathFor({
    context: input.runner.context,
    state: input.assigned,
    attempt: input.started.attempt,
  });
  const segmentArtifact = createPreflightSegmentArtifact({
    source: input.runner.context.source,
    assignmentDigest: input.runner.context.assignment.assignmentDigest,
    state: input.sourceState,
    route: input.route,
    segment: input.segment,
  });
  const receipt = createPreflightShardStateReceipt({
    context: input.runner.context,
    state: input.assigned,
    started: input.started,
    segmentArtifactPath,
    segmentArtifact,
  });
  await input.assertBoundary(input.runner);
  await assertPreflightArchivePath(
    input.runner.archiveRoot,
    segmentArtifactPath,
  );
  await writePreflightSegmentArtifact({
    archiveRoot: input.runner.archiveRoot,
    filePath: segmentArtifactPath,
    artifact: segmentArtifact,
  });
  await input.assertBoundary(input.runner);
  await assertPreflightArchivePath(input.runner.archiveRoot, receiptPath);
  await writePreflightShardStateReceipt({
    context: input.runner.context,
    archiveRoot: input.runner.archiveRoot,
    filePath: receiptPath,
    receipt,
  });
  await input.assertBoundary(input.runner);
  return receiptPath;
};

const appendStartedForAttempt = async (input: {
  readonly runner: PreflightShardRunnerInput;
  readonly assigned: PreflightShardState;
  readonly assertBoundary: (runner: PreflightShardRunnerInput) => Promise<void>;
}): Promise<Awaited<ReturnType<typeof appendPreflightShardJournalStarted>>> => {
  await input.assertBoundary(input.runner);
  const record = await appendPreflightShardJournalStarted({
    context: input.runner.context,
    archiveRoot: input.runner.archiveRoot,
    filePath: input.runner.journalPath,
    state: input.assigned,
  });
  try {
    await input.assertBoundary(input.runner);
  } catch (error: unknown) {
    return appendFailureAndStop({
      runner: input.runner,
      state: input.assigned,
      error,
      assertBoundary: input.assertBoundary,
    });
  }
  return record;
};

export const runPreflightShardStateAttempt = async (input: {
  readonly runner: PreflightShardRunnerInput;
  readonly assigned: PreflightShardState;
  readonly sourceState: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly resetRequired: boolean;
  readonly assertBoundary: (runner: PreflightShardRunnerInput) => Promise<void>;
}): Promise<string> => {
  const started = await appendStartedForAttempt(input);
  try {
    await input.runner.assertLiveSource();
    const result = await input.runner.runState({
      source: input.runner.context.source,
      assignment: input.runner.context.assignment,
      state: input.sourceState,
      route: input.route,
      resetRequired: input.resetRequired,
    });
    await input.runner.assertLiveSource();
    const segment = segmentForResult(result);
    assertStateResult(input.sourceState, segment);
    const preparedGroup = preparedGroupForResult(
      result,
      preflightSessionGroupKey(input.sourceState, input.route),
    );
    const receiptPath = await writeAttemptEvidence({
      ...input,
      started,
      segment,
    });
    await input.assertBoundary(input.runner);
    await appendPreflightShardJournalTerminal({
      context: input.runner.context,
      archiveRoot: input.runner.archiveRoot,
      filePath: input.runner.journalPath,
      status: "PASS",
      receiptPath,
    });
    await input.assertBoundary(input.runner);
    return preparedGroup;
  } catch (error: unknown) {
    return appendFailureAndStop({
      ...input,
      state: input.assigned,
      error,
    });
  }
};
