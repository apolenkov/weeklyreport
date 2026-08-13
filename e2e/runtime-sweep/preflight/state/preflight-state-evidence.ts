import type { MatrixPreflightSegment } from "../../matrix/finalization/matrix-finalizer-contract.ts";
import { freezeDeep } from "../../source/manifest-source.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { stableSerialize } from "../../support/ids.ts";
import {
  assertPreflightAssignmentMatchesSource,
  createPreflightAssignment,
  parsePreflightAssignment,
  type PreflightAssignment,
} from "../artifacts/preflight-assignment.ts";
import type { PreflightRoute } from "../execution/playwright-preflight-support.ts";
import {
  parsePreflightSegmentArtifact,
  type PreflightSegmentArtifact,
  preflightSegmentForArtifact,
  readPreflightSegmentArtifact,
} from "../journal/preflight-journal-artifact.ts";
import {
  assertPreflightArchivePath,
  assertPreflightRegularFile,
} from "../preflight-archive-path.ts";
import { resolvePreflightStateSelector } from "./preflight-state-selector.ts";
import {
  type PreflightStateSelection,
  type PreflightStateSelector,
  PreflightStateSelectorError,
} from "./preflight-state-selector-contract.ts";

/**
 * A typed view over the existing immutable `PREFLIGHT_SEGMENT` artifact.
 * This wrapper adds no artifact kind, file format, or write path.
 */
export type PreflightStateEvidence = Readonly<{
  readonly selector: PreflightStateSelector;
  readonly state: PreflightStateSelection["state"];
  readonly route: PreflightRoute;
  readonly artifact: PreflightSegmentArtifact;
  readonly segment: MatrixPreflightSegment;
}>;

export class PreflightStateEvidenceError extends Error {
  override readonly name = "PreflightStateEvidenceError";
}

const statePayloadFor = (state: PreflightStateSelection["state"]) => ({
  stateId: state.stateId,
  pairwiseDigest: state.pairwiseDigest,
  profile: state.profile,
  axes: state.axes,
});

const assertStateEvidenceBinding = (input: {
  readonly selection: PreflightStateSelection;
  readonly artifact: PreflightSegmentArtifact;
}): void => {
  const { selection, artifact } = input;
  const expectedState = statePayloadFor(selection.state);
  const checks: readonly (readonly [string, boolean])[] = [
    ["source SHA", artifact.sourceSha === selection.selector.sourceSha],
    ["source tree", artifact.sourceTree === selection.selector.sourceTree],
    ["tree digest", artifact.treeDigest === selection.selector.treeDigest],
    [
      "source digest",
      artifact.sourceDigest === selection.selector.sourceDigest,
    ],
    ["plan digest", artifact.planDigest === selection.selector.planDigest],
    ["state identity", artifact.state.stateId === selection.selector.stateId],
    ["state digest", artifact.stateDigest === selection.selector.stateDigest],
    [
      "pairwise digest",
      artifact.state.pairwiseDigest === selection.selector.pairwiseDigest,
    ],
    [
      "state payload",
      stableSerialize(artifact.state) === stableSerialize(expectedState),
    ],
    [
      "segment state",
      stableSerialize(artifact.segment.state) ===
        stableSerialize(expectedState),
    ],
    ["role", artifact.role === selection.selector.role],
    [
      "catalog route",
      artifact.catalogRoute === selection.selector.catalogRoute,
    ],
    [
      "resolved route",
      artifact.resolvedRoute === selection.selector.resolvedRoute,
    ],
  ];
  const mismatches = checks
    .filter(([, matches]) => !matches)
    .map(([field]) => field);
  if (mismatches.length > 0)
    throw new PreflightStateEvidenceError(
      `PREFLIGHT_SEGMENT does not match exact state selector: ${mismatches.join(
        ", ",
      )}`,
    );
};

const selectionFor = (input: {
  readonly source: SourceArtifact;
  readonly selector: unknown;
}): PreflightStateSelection => {
  try {
    return resolvePreflightStateSelector(input);
  } catch (error: unknown) {
    if (error instanceof PreflightStateSelectorError) throw error;
    throw new PreflightStateEvidenceError(
      `Cannot resolve state evidence selector: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const artifactFor = (value: unknown): PreflightSegmentArtifact => {
  try {
    return parsePreflightSegmentArtifact(value);
  } catch (error: unknown) {
    throw new PreflightStateEvidenceError(
      `Invalid PREFLIGHT_SEGMENT evidence: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const assignmentFor = (
  source: SourceArtifact,
  assignment: PreflightAssignment | undefined,
): PreflightAssignment => {
  // v1 state evidence accepts only the current sequential assignment. A
  // future shard assignment must use a separately versioned binder.
  const current =
    assignment === undefined
      ? createPreflightAssignment(source)
      : parsePreflightAssignment(assignment);
  assertPreflightAssignmentMatchesSource(source, current);
  return current;
};

/**
 * Binds an already parsed `PREFLIGHT_SEGMENT` to an exact current SOURCE
 * selector. The artifact parser remains authoritative for segment/artifact
 * digests and reveal payload validation.
 */
export function createPreflightStateEvidence(input: {
  readonly source: SourceArtifact;
  readonly selector: unknown;
  readonly artifact: unknown;
  readonly assignment?: PreflightAssignment;
}): PreflightStateEvidence {
  const selection = selectionFor({
    source: input.source,
    selector: input.selector,
  });
  const artifact = artifactFor(input.artifact);
  const assignment = assignmentFor(input.source, input.assignment);
  if (artifact.assignmentDigest !== assignment.assignmentDigest)
    throw new PreflightStateEvidenceError(
      `PREFLIGHT_SEGMENT assignment digest does not match the current sequential assignment: expected ${assignment.assignmentDigest}, got ${artifact.assignmentDigest}`,
    );
  assertStateEvidenceBinding({ selection, artifact });
  const segment = preflightSegmentForArtifact(artifact);
  return freezeDeep({
    selector: selection.selector,
    state: selection.state,
    route: selection.route,
    artifact,
    segment,
  });
}

/**
 * Reads one state-scoped `PREFLIGHT_SEGMENT` under the existing archive-root,
 * regular-file, and symlink guards before applying the typed binding above.
 */
export async function readPreflightStateEvidence(input: {
  readonly source: SourceArtifact;
  readonly selector: unknown;
  readonly archiveRoot: string;
  readonly filePath: string;
  readonly assignment?: PreflightAssignment;
}): Promise<PreflightStateEvidence> {
  await assertPreflightArchivePath(input.archiveRoot, input.filePath);
  await assertPreflightRegularFile(input.filePath);
  return createPreflightStateEvidence({
    source: input.source,
    selector: input.selector,
    artifact: await readPreflightSegmentArtifact(input.filePath),
    ...(input.assignment === undefined ? {} : { assignment: input.assignment }),
  });
}
