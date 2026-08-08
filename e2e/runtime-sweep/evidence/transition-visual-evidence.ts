import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import { writeFrozenCaseArtifact } from "../replay/frozen-case-artifacts.ts";
import {
  type EvidenceBundle,
  evidenceBundleSchema,
  evidenceObservationSchema,
  type EvidenceRef,
} from "../source/contracts.ts";
import { digest } from "./capture/artifacts.ts";
import type { GeometrySnapshot } from "./evidence-types.ts";
import {
  evaluateTransitionVisualPair,
  parseGeometrySnapshot,
  type TransitionVisualEvaluation,
  type TransitionVisualPolicy,
} from "./transition-visual-evaluation.ts";

export interface TransitionVisualEvidenceInput {
  readonly archiveRoot: string;
  readonly matrixCase: MatrixExecutableCase;
  readonly before: EvidenceBundle;
  readonly after: EvidenceBundle;
  readonly policy?: TransitionVisualPolicy;
}

const phaseRef = (
  refs: readonly EvidenceRef[],
  kind: EvidenceRef["kind"],
  fileName: string,
): EvidenceRef => {
  const matches = refs.filter(
    (ref) => ref.kind === kind && path.basename(ref.archivePath) === fileName,
  );
  if (matches.length !== 1)
    throw new Error(
      `Transition visual evidence requires exactly one ${fileName}; found ${matches.length}`,
    );
  const match = matches[0];
  if (match === undefined)
    throw new Error(`Transition visual evidence ${fileName} is missing`);
  return match;
};

const readImmutableArtifact = async (
  archiveRoot: string,
  ref: EvidenceRef,
): Promise<Buffer> => {
  const root = path.resolve(archiveRoot);
  const candidate = path.resolve(ref.archivePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`))
    throw new Error(`Transition visual artifact escaped archive: ${candidate}`);
  const stat = await lstat(candidate);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error(
      `Transition visual artifact is not a regular file: ${candidate}`,
    );
  const [realRoot, realCandidate] = await Promise.all([
    realpath(root),
    realpath(candidate),
  ]);
  if (
    realCandidate !== realRoot &&
    !realCandidate.startsWith(`${realRoot}${path.sep}`)
  )
    throw new Error(
      `Transition visual artifact traverses a symlink: ${candidate}`,
    );
  const content = await readFile(candidate);
  if (digest(content) !== ref.digest)
    throw new Error(`Transition visual artifact digest changed: ${candidate}`);
  return content;
};

const loadGeometry = async (
  archiveRoot: string,
  ref: EvidenceRef,
): Promise<GeometrySnapshot> =>
  parseGeometrySnapshot(
    JSON.parse(
      (await readImmutableArtifact(archiveRoot, ref)).toString("utf8"),
    ),
  );

const pairArtifactValue = (
  input: TransitionVisualEvidenceInput,
  refs: Readonly<{
    beforeScreenshot: EvidenceRef;
    afterScreenshot: EvidenceRef;
    beforeGeometry: EvidenceRef;
    afterGeometry: EvidenceRef;
  }>,
  evaluation: TransitionVisualEvaluation,
  capturedAt: string,
): unknown => ({
  schemaVersion: 1,
  identity: {
    cellId: input.matrixCase.caseId,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    route: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    state: input.matrixCase.state,
    execution: input.matrixCase.execution,
    capturedAt,
  },
  transition: input.matrixCase.state.controlTransition,
  screenshots: {
    before: {
      artifactId: refs.beforeScreenshot.artifactId,
      digest: refs.beforeScreenshot.digest,
    },
    after: {
      artifactId: refs.afterScreenshot.artifactId,
      digest: refs.afterScreenshot.digest,
    },
  },
  geometry: {
    before: refs.beforeGeometry.artifactId,
    after: refs.afterGeometry.artifactId,
  },
  evaluation,
});

const writePairRef = (
  input: TransitionVisualEvidenceInput,
  refs: Parameters<typeof pairArtifactValue>[1],
  evaluation: TransitionVisualEvaluation,
  capturedAt: string,
): Promise<EvidenceRef> =>
  writeFrozenCaseArtifact({
    archiveRoot: input.archiveRoot,
    sourceSha: input.matrixCase.sourceSha,
    profile: input.matrixCase.profile,
    role: input.matrixCase.role,
    catalogRoute: input.matrixCase.catalogRoute,
    resolvedRoute: input.matrixCase.resolvedRoute,
    cellId: input.matrixCase.caseId,
    phase: "after",
    fileName: "transition-visual.json",
    kind: "geometry",
    dimension: "visual",
    capturedAt,
    value: pairArtifactValue(input, refs, evaluation, capturedAt),
  });

const transitionObservation = (
  evaluation: TransitionVisualEvaluation,
  refs: readonly EvidenceRef[],
): EvidenceBundle["observations"][number] =>
  evidenceObservationSchema.parse({
    observationId: "transition-visual",
    kind: "geometry",
    outcome: evaluation.outcome,
    message:
      evaluation.outcome === "pass"
        ? `Before/after geometry matched ${evaluation.movements.length} stable layout landmark(s)`
        : evaluation.issues.join("; "),
    evidenceIds: refs.map(({ artifactId }) => artifactId),
  });

export async function attachTransitionVisualEvidence(
  input: TransitionVisualEvidenceInput,
): Promise<EvidenceBundle> {
  const beforeScreenshot = phaseRef(
    input.before.before,
    "screenshot",
    "screenshot.png",
  );
  const afterScreenshot = phaseRef(
    input.after.after,
    "screenshot",
    "screenshot.png",
  );
  const beforeGeometryRef = phaseRef(
    input.before.before,
    "geometry",
    "geometry.json",
  );
  const afterGeometryRef = phaseRef(
    input.after.after,
    "geometry",
    "geometry.json",
  );
  await Promise.all([
    readImmutableArtifact(input.archiveRoot, beforeScreenshot),
    readImmutableArtifact(input.archiveRoot, afterScreenshot),
  ]);
  const [beforeGeometry, afterGeometry] = await Promise.all([
    loadGeometry(input.archiveRoot, beforeGeometryRef),
    loadGeometry(input.archiveRoot, afterGeometryRef),
  ]);
  const transition = input.matrixCase.state.controlTransition;
  const evaluation = evaluateTransitionVisualPair(
    beforeGeometry,
    afterGeometry,
    transition,
    input.policy,
  );
  const capturedAt = new Date().toISOString();
  const pairRefs = {
    beforeScreenshot,
    afterScreenshot,
    beforeGeometry: beforeGeometryRef,
    afterGeometry: afterGeometryRef,
  };
  const pairRef = await writePairRef(input, pairRefs, evaluation, capturedAt);
  const evidence = [
    beforeScreenshot,
    beforeGeometryRef,
    afterScreenshot,
    afterGeometryRef,
    pairRef,
  ];
  const observation = transitionObservation(evaluation, evidence);
  return evidenceBundleSchema.parse({
    ...input.after,
    after: [...input.after.after, pairRef],
    observations: [...input.after.observations, observation],
  });
}
