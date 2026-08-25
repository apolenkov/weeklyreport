import type { MatrixPreflightSegment } from "../../matrix/finalization/matrix-finalizer-contract.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import {
  createPreflightArtifact,
  type PreflightArtifact,
} from "../artifacts/preflight-artifact.ts";
import {
  type PreflightAssignment,
  preflightAssignmentStateFor,
  readPreflightAssignment,
} from "../artifacts/preflight-assignment.ts";
import type { BrowserPreflightSegmentResult } from "../execution/playwright-preflight.ts";
import {
  attachSpecializedDeclarations,
  type PreflightRoute,
  routeForState,
} from "../execution/playwright-preflight-support.ts";
import {
  assertPreflightArchivePath,
  ensurePreflightArchiveDirectory,
} from "../preflight-archive-path.ts";
import type { PreflightJournalRecord } from "./preflight-journal-contract.ts";
import { readPreflightJournal } from "./preflight-journal-io.ts";
import {
  artifactReaderForFiles,
  assembleCanonicalPreflightSegments,
  resolvePreflightResume,
} from "./preflight-journal-resume.ts";
import { createPreflightJournalWriter } from "./preflight-journal-writer.ts";

export class PreflightJournalRunnerError extends Error {
  override readonly name: string = "PreflightJournalRunnerError";
}

export class PreflightStateAmbiguousError extends PreflightJournalRunnerError {
  override readonly name = "PreflightStateAmbiguousError";
}

export type PreflightStateRunner = (input: {
  readonly source: SourceArtifact;
  readonly assignment: PreflightAssignment;
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
  readonly resetRequired: boolean;
}) => Promise<MatrixPreflightSegment | BrowserPreflightSegmentResult>;

export type JournaledPreflightInput = Readonly<{
  readonly source: SourceArtifact;
  readonly assignment: PreflightAssignment;
  readonly archiveRoot: string;
  readonly assignmentPath?: string;
  readonly journalPath: string;
  readonly segmentRoot: string;
  readonly preflightPath: string;
  readonly runState: PreflightStateRunner;
  readonly assertLiveSource: () => Promise<void>;
  /**
   * Recreates and verifies the disposable state/session boundary once after
   * journal/source/assignment validation and before any resume skip.
   */
  readonly recreateDisposableBoundary: () => Promise<void>;
  readonly readSource?: () => Promise<SourceArtifact>;
  readonly readAssignment?: () => Promise<PreflightAssignment>;
}>;

export type JournaledPreflightResult = Readonly<{
  readonly artifact: PreflightArtifact;
  readonly assignment: PreflightAssignment;
  readonly journalRecords: readonly PreflightJournalRecord[];
  readonly skippedStateIds: readonly string[];
  readonly rerunStateIds: readonly string[];
}>;

export type BoundaryVerifier = () => Promise<void>;
export type AssignmentReader = () => Promise<PreflightAssignment>;

export type JournalStateContext = Readonly<{
  readonly resume: Awaited<ReturnType<typeof resolvePreflightResume>>;
  readonly writer: ReturnType<typeof createPreflightJournalWriter>;
  readonly segments: Map<string, MatrixPreflightSegment>;
}>;

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const assignmentReaderFor = (input: {
  readonly assignment: PreflightAssignment;
  readonly assignmentPath?: string;
  readonly archiveRoot: string;
}): AssignmentReader => {
  const assignmentPath = input.assignmentPath;
  if (assignmentPath === undefined)
    return () => Promise.resolve(input.assignment);
  return async () => {
    await assertPreflightArchivePath(input.archiveRoot, assignmentPath);
    return readPreflightAssignment(assignmentPath);
  };
};

const routeForAssignmentState = (
  source: SourceArtifact,
  assignment: PreflightAssignment,
  stateId: string,
): PreflightRoute => {
  const expected = source.plan.states.find(
    ({ stateId: candidate }) => candidate === stateId,
  );
  if (expected === undefined)
    throw new PreflightJournalRunnerError(
      `Preflight assignment references a foreign state ${stateId}`,
    );
  const assigned = preflightAssignmentStateFor(assignment, stateId);
  const route = routeForState(source, expected);
  if (
    assigned.role !== route.role ||
    assigned.catalogRoute !== route.catalogRoute ||
    assigned.resolvedRoute !== route.resolvedRoute
  )
    throw new PreflightJournalRunnerError(
      `Preflight assignment route identity drifted for ${stateId}`,
    );
  return route;
};

const assertAssignmentIdentity = (
  expected: PreflightAssignment,
  actual: PreflightAssignment,
): void => {
  if (stableSerialize(actual) !== stableSerialize(expected))
    throw new PreflightJournalRunnerError(
      "PREFLIGHT_ASSIGNMENT changed during preflight",
    );
};

export const boundaryVerifierFor =
  (
    input: JournaledPreflightInput,
    readAssignment: AssignmentReader,
  ): BoundaryVerifier =>
  async () => {
    await input.assertLiveSource();
    if (input.readSource !== undefined) {
      const actualSource = await input.readSource();
      if (stableSerialize(actualSource) !== stableSerialize(input.source))
        throw new PreflightJournalRunnerError(
          "SOURCE.json changed during preflight",
        );
    }
    assertAssignmentIdentity(input.assignment, await readAssignment());
  };

export const prepareJournalStateContext = async (
  input: JournaledPreflightInput,
): Promise<JournalStateContext> => {
  await ensurePreflightArchiveDirectory(input.archiveRoot, input.segmentRoot);
  if (input.assignmentPath !== undefined)
    await assertPreflightArchivePath(input.archiveRoot, input.assignmentPath);
  await assertPreflightArchivePath(input.archiveRoot, input.journalPath);
  await assertPreflightArchivePath(input.archiveRoot, input.preflightPath);
  const records = await readPreflightJournal(
    input.journalPath,
    input.archiveRoot,
  );
  const resume = await resolvePreflightResume({
    source: input.source,
    assignmentDigest: input.assignment.assignmentDigest,
    records,
    readArtifact: artifactReaderForFiles(input.source, input.archiveRoot),
  });
  return {
    resume,
    writer: createPreflightJournalWriter({
      filePath: input.journalPath,
      source: input.source,
      assignmentDigest: input.assignment.assignmentDigest,
      archiveRoot: input.archiveRoot,
    }),
    segments: new Map(resume.terminalSegments),
  };
};

export const stateForAssignment = (
  input: JournaledPreflightInput,
  assigned: PreflightAssignment["states"][number],
): Readonly<{
  readonly state: SourceArtifact["plan"]["states"][number];
  readonly route: PreflightRoute;
}> => {
  const state = input.source.plan.states[assigned.planIndex];
  if (state?.stateId !== assigned.state.stateId)
    throw new PreflightJournalRunnerError(
      `PREFLIGHT_ASSIGNMENT plan index drifted for ${assigned.state.stateId}`,
    );
  return {
    state,
    route: routeForAssignmentState(
      input.source,
      input.assignment,
      state.stateId,
    ),
  };
};

export const canonicalArtifactFor = (
  source: SourceArtifact,
  assignment: PreflightAssignment,
  segments: ReadonlyMap<string, MatrixPreflightSegment>,
): PreflightArtifact => {
  const orderedSegments = assembleCanonicalPreflightSegments({
    source,
    segments: assignment.states.map(({ state }) => {
      const segment = segments.get(state.stateId);
      if (segment === undefined)
        throw new PreflightJournalRunnerError(
          `Missing validated segment ${state.stateId}`,
        );
      return segment;
    }),
  });
  return createPreflightArtifact({
    source,
    segments: attachSpecializedDeclarations(source, orderedSegments),
  });
};
