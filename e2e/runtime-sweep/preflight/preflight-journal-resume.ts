import type { MatrixPreflightSegment } from "../matrix/matrix-finalizer-contract.ts";
import { freezeDeep } from "../source/manifest-source.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import { assertPreflightArchivePath } from "./preflight-archive-path.ts";
import { compactPreflightRevealData } from "./preflight-artifact-reveal.ts";
import {
  preflightSegmentForArtifact,
  readPreflightSegmentArtifact,
} from "./preflight-journal-artifact.ts";
import {
  PreflightJournalError,
  preflightJournalIdentityFor,
  type PreflightJournalPassRecord,
  type PreflightJournalRecord,
} from "./preflight-journal-contract.ts";
import { validatePreflightJournal } from "./preflight-journal-validation.ts";

export type RevalidatedPreflightPass = Readonly<{
  readonly record: PreflightJournalPassRecord;
  readonly segment: MatrixPreflightSegment;
}>;

export type PreflightJournalArtifactReader = (input: {
  readonly record: PreflightJournalPassRecord;
}) => Promise<RevalidatedPreflightPass>;

const assertPassArtifactBinding = (
  record: PreflightJournalPassRecord,
  artifact: RevalidatedPreflightPass,
  source: SourceArtifact,
): void => {
  const segment = artifact.segment;
  if (segment.state.stateId !== record.state.stateId)
    throw new PreflightJournalError(
      `Terminal artifact state does not match ${record.state.stateId}`,
    );
  if (segment.state.pairwiseDigest !== record.state.pairwiseDigest)
    throw new PreflightJournalError(
      `Terminal artifact state digest does not match ${record.state.stateId}`,
    );
  const compact = compactPreflightRevealData([segment]).segments[0];
  if (compact === undefined || sha256Hex(compact) !== record.segmentDigest)
    throw new PreflightJournalError(
      `Terminal segment digest does not match ${record.state.stateId}`,
    );
  const expected = source.plan.states.find(
    ({ stateId }) => stateId === record.state.stateId,
  );
  if (expected === undefined)
    throw new PreflightJournalError(
      "Terminal artifact references a foreign state",
    );
  if (stableSerialize(segment.state.axes) !== stableSerialize(expected.axes))
    throw new PreflightJournalError(
      `Terminal artifact axes do not match ${record.state.stateId}`,
    );
};

export async function revalidatePreflightJournal(input: {
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly records: readonly PreflightJournalRecord[];
  readonly readArtifact: PreflightJournalArtifactReader;
}): Promise<ReadonlyMap<string, RevalidatedPreflightPass>> {
  const validation = validatePreflightJournal(input);
  const result = new Map<string, RevalidatedPreflightPass>();
  for (const record of validation.passRecords.values()) {
    const artifact = await input.readArtifact({
      record,
    });
    if (artifact.record.recordDigest !== record.recordDigest)
      throw new PreflightJournalError(
        `Terminal artifact reader returned a different journal record for ${record.state.stateId}`,
      );
    assertPassArtifactBinding(record, artifact, input.source);
    result.set(record.state.stateId, artifact);
  }
  return result;
}

// artifactPath is a locator only. The artifact bytes and every source/state
// identity field are authoritative; root confinement remains runner policy.
export const artifactReaderForFiles =
  (
    source: SourceArtifact,
    archiveRoot?: string,
  ): PreflightJournalArtifactReader =>
  async ({ record }) => {
    if (archiveRoot !== undefined)
      await assertPreflightArchivePath(archiveRoot, record.artifactPath);
    const artifact = await readPreflightSegmentArtifact(record.artifactPath);
    const expectedState = source.plan.states.find(
      ({ stateId }) => stateId === record.state.stateId,
    );
    if (expectedState === undefined)
      throw new PreflightJournalError(
        `PASS artifact for ${record.state.stateId} references a foreign state`,
      );
    const identity = preflightJournalIdentityFor(
      source,
      record.assignmentDigest,
      expectedState,
    );
    const identityMatches =
      artifact.artifactDigest === record.artifactDigest &&
      artifact.sourceSha === identity.sourceSha &&
      artifact.sourceTree === identity.sourceTree &&
      artifact.treeDigest === identity.treeDigest &&
      artifact.sourceDigest === identity.sourceDigest &&
      artifact.planDigest === identity.planDigest &&
      artifact.assignmentDigest === identity.assignmentDigest &&
      stableSerialize(artifact.state) === stableSerialize(identity.state) &&
      artifact.stateDigest === identity.stateDigest &&
      artifact.role === identity.role &&
      artifact.catalogRoute === identity.catalogRoute &&
      artifact.resolvedRoute === identity.resolvedRoute;
    if (!identityMatches)
      throw new PreflightJournalError(
        `PASS artifact for ${record.state.stateId} does not match journal identity`,
      );
    return { record, segment: preflightSegmentForArtifact(artifact) };
  };

export type PreflightResumePlan = Readonly<{
  readonly skipStateIds: readonly string[];
  readonly rerunStateIds: readonly string[];
  readonly terminalSegments: ReadonlyMap<string, MatrixPreflightSegment>;
}>;

export async function resolvePreflightResume(input: {
  readonly source: SourceArtifact;
  readonly assignmentDigest: string;
  readonly records: readonly PreflightJournalRecord[];
  readonly readArtifact: PreflightJournalArtifactReader;
}): Promise<PreflightResumePlan> {
  const validation = validatePreflightJournal(input);
  const revalidated = await revalidatePreflightJournal(input);
  const skipStateIds: string[] = [];
  const rerunStateIds: string[] = [];
  const terminalSegments = new Map<string, MatrixPreflightSegment>();
  input.source.plan.states.forEach((state) => {
    const latest = validation.latestByState.get(state.stateId);
    const pass =
      latest?.status === "PASS" ? revalidated.get(state.stateId) : undefined;
    if (pass === undefined) rerunStateIds.push(state.stateId);
    else {
      skipStateIds.push(state.stateId);
      terminalSegments.set(state.stateId, pass.segment);
    }
  });
  return freezeDeep({ skipStateIds, rerunStateIds, terminalSegments });
}

export function assembleCanonicalPreflightSegments(input: {
  readonly source: SourceArtifact;
  readonly segments: readonly MatrixPreflightSegment[];
}): readonly MatrixPreflightSegment[] {
  const byState = new Map<string, MatrixPreflightSegment>();
  const duplicateIds = new Set<string>();
  input.segments.forEach((segment) => {
    const stateId = segment.state.stateId;
    if (byState.has(stateId)) duplicateIds.add(stateId);
    byState.set(stateId, segment);
  });
  const expectedIds = input.source.plan.states.map(({ stateId }) => stateId);
  const expected = new Set(expectedIds);
  const extra = [...byState.keys()].filter((stateId) => !expected.has(stateId));
  const missing = expectedIds.filter((stateId) => !byState.has(stateId));
  if (duplicateIds.size > 0 || extra.length > 0 || missing.length > 0)
    throw new PreflightJournalError(
      [
        ...[...duplicateIds].map((stateId) => `duplicate state ${stateId}`),
        ...extra.map((stateId) => `foreign state ${stateId}`),
        ...missing.map((stateId) => `missing state ${stateId}`),
      ].join("; "),
    );
  return expectedIds.map((stateId) => {
    const segment = byState.get(stateId);
    if (segment === undefined)
      throw new PreflightJournalError(`Missing canonical state ${stateId}`);
    return segment;
  });
}
