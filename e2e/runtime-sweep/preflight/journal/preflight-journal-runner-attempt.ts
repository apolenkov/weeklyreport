import * as path from "node:path";

import type { MatrixPreflightSegment } from "../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import type { BrowserPreflightSegmentResult } from "../execution/playwright-preflight.ts";
import { assertPreflightArchivePath } from "../preflight-archive-path.ts";
import {
  createPreflightSegmentArtifact,
  writePreflightSegmentArtifact,
} from "./preflight-journal-artifact.ts";
import type { PreflightJournalStatus } from "./preflight-journal-contract.ts";
import {
  type BoundaryVerifier,
  errorMessage,
  type JournaledPreflightInput,
  type JournalStateContext,
  PreflightJournalRunnerError,
  PreflightStateAmbiguousError,
} from "./preflight-journal-runner-support.ts";

const segmentForResult = (
  result: MatrixPreflightSegment | BrowserPreflightSegmentResult,
): MatrixPreflightSegment => ("segment" in result ? result.segment : result);

const statusForError = (
  error: unknown,
): Exclude<PreflightJournalStatus, "STARTED"> =>
  error instanceof PreflightStateAmbiguousError ? "AMBIGUOUS" : "FAIL";

const assertStateResult = (
  expected: SourceArtifact["plan"]["states"][number],
  segment: MatrixPreflightSegment,
): void => {
  if (segment.state.stateId !== expected.stateId)
    throw new PreflightJournalRunnerError(
      `Preflight state runner returned ${segment.state.stateId} for ${expected.stateId}`,
    );
  if (segment.state.pairwiseDigest !== expected.pairwiseDigest)
    throw new PreflightJournalRunnerError(
      `Preflight state runner returned a digest-drifted state ${expected.stateId}`,
    );
  if (stableSerialize(segment.state) !== stableSerialize(expected))
    throw new PreflightJournalRunnerError(
      `Preflight state runner returned a payload-drifted state ${expected.stateId}`,
    );
};

const appendFailure = async (input: {
  readonly writer: JournalStateContext["writer"];
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly error: unknown;
  readonly status: Exclude<PreflightJournalStatus, "STARTED">;
}): Promise<never> => {
  try {
    await input.writer.appendTerminal({
      state: input.state,
      status: input.status,
    });
  } catch (appendError: unknown) {
    throw new PreflightJournalRunnerError(
      `State ${input.state.stateId} failed (${errorMessage(input.error)}) and terminal journal append failed (${errorMessage(appendError)})`,
    );
  }
  throw new PreflightJournalRunnerError(
    `Preflight state ${input.state.stateId} ended ${input.status}: ${errorMessage(input.error)}`,
  );
};

const artifactPathFor = (
  segmentRoot: string,
  stateId: string,
  attempt: number,
): string =>
  path.join(segmentRoot, `${stateId}.attempt-${String(attempt)}.json`);

export const runStateAttempt = async (input: {
  readonly runner: JournaledPreflightInput;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: Parameters<JournaledPreflightInput["runState"]>[0]["route"];
  readonly context: JournalStateContext;
  readonly verifyBoundary: BoundaryVerifier;
}): Promise<void> => {
  const started = await input.context.writer.appendStarted({
    state: input.state,
  });
  try {
    const segment = segmentForResult(
      await input.runner.runState({
        source: input.runner.source,
        assignment: input.runner.assignment,
        state: input.state,
        route: input.route,
        resetRequired: true,
      }),
    );
    assertStateResult(input.state, segment);
    await input.verifyBoundary();
    const artifactPath = artifactPathFor(
      input.runner.segmentRoot,
      input.state.stateId,
      started.attempt,
    );
    await assertPreflightArchivePath(input.runner.archiveRoot, artifactPath);
    const artifact = createPreflightSegmentArtifact({
      source: input.runner.source,
      assignmentDigest: input.runner.assignment.assignmentDigest,
      state: input.state,
      route: input.route,
      segment,
    });
    await writePreflightSegmentArtifact({
      archiveRoot: input.runner.archiveRoot,
      filePath: artifactPath,
      artifact,
    });
    // The boundary check is the qualification for publishing PASS. A source
    // or assignment change after capture must leave only a rerunnable attempt,
    // never a terminal PASS that resume could later skip.
    await input.verifyBoundary();
    await input.context.writer.appendTerminal({
      state: input.state,
      status: "PASS",
      segmentDigest: artifact.segmentDigest,
      artifactPath,
      artifactDigest: artifact.artifactDigest,
    });
    input.context.segments.set(input.state.stateId, segment);
  } catch (error: unknown) {
    return appendFailure({
      writer: input.context.writer,
      state: input.state,
      error,
      status: statusForError(error),
    });
  }
};
