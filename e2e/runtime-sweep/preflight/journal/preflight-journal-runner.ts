import { writePreflightArtifact } from "../artifacts/preflight-artifact.ts";
import { assertPreflightAssignmentMatchesSource } from "../artifacts/preflight-assignment.ts";
import { readPreflightJournal } from "./preflight-journal-io.ts";
import { runStateAttempt } from "./preflight-journal-runner-attempt.ts";
import {
  assignmentReaderFor,
  boundaryVerifierFor,
  canonicalArtifactFor,
  type JournaledPreflightInput,
  type JournaledPreflightResult,
  PreflightJournalRunnerError,
  PreflightStateAmbiguousError,
  type PreflightStateRunner,
  prepareJournalStateContext,
  stateForAssignment,
} from "./preflight-journal-runner-support.ts";

export { PreflightJournalRunnerError, PreflightStateAmbiguousError };
export type {
  JournaledPreflightInput,
  JournaledPreflightResult,
  PreflightStateRunner,
};

/**
 * Runs one serialized whole-state preflight journal. A PASS record is skipped
 * only after its immutable segment has been revalidated; every other state
 * starts again with resetRequired=true.
 */
export async function runJournaledPreflight(
  input: JournaledPreflightInput,
): Promise<JournaledPreflightResult> {
  assertPreflightAssignmentMatchesSource(input.source, input.assignment);
  const readAssignment =
    input.readAssignment ??
    assignmentReaderFor({
      assignment: input.assignment,
      archiveRoot: input.archiveRoot,
      ...(input.assignmentPath === undefined
        ? {}
        : { assignmentPath: input.assignmentPath }),
    });
  const verifyBoundary = boundaryVerifierFor(input, readAssignment);
  const context = await prepareJournalStateContext(input);
  await verifyBoundary();
  if (context.resume.skipStateIds.length > 0) {
    await input.recreateDisposableBoundary();
    await verifyBoundary();
  }
  const rerunStateIds: string[] = [];
  for (const assigned of input.assignment.states) {
    const { state, route } = stateForAssignment(input, assigned);
    await verifyBoundary();
    if (context.resume.skipStateIds.includes(state.stateId)) {
      await verifyBoundary();
      continue;
    }
    rerunStateIds.push(state.stateId);
    await runStateAttempt({
      runner: input,
      state,
      route,
      context,
      verifyBoundary,
    });
  }
  await verifyBoundary();
  const artifact = canonicalArtifactFor(
    input.source,
    input.assignment,
    context.segments,
  );
  await writePreflightArtifact(
    input.preflightPath,
    artifact,
    input.archiveRoot,
  );
  return {
    artifact,
    assignment: input.assignment,
    journalRecords: await readPreflightJournal(
      input.journalPath,
      input.archiveRoot,
    ),
    skippedStateIds: context.resume.skipStateIds,
    rerunStateIds,
  };
}
