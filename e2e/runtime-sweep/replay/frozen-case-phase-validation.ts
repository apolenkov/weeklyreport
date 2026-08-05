import type { EvidencePhase } from "../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type {
  EvidenceBundle,
  EvidenceDimension,
  EvidenceRef,
} from "../source/contracts.ts";

const CONSOLE_KIND: EvidenceRef["kind"] = "console";
const PAGE_ERROR_KIND: EvidenceRef["kind"] = "page-error";
const REQUEST_KIND: EvidenceRef["kind"] = "request";
const PHASES: readonly EvidencePhase[] = ["before", "action", "after"];
const REQUIRED_PHASE_KINDS: Readonly<
  Record<EvidenceDimension, readonly EvidenceRef["kind"][]>
> = {
  function: ["api"],
  accessibility: ["dom", "axe", "keyboard"],
  visual: ["screenshot", "geometry"],
  runtime: [CONSOLE_KIND, PAGE_ERROR_KIND, REQUEST_KIND, "url"],
};
const REQUIRED_OBSERVATIONS: readonly Readonly<{
  readonly observationId: string;
  readonly evidenceKinds: readonly EvidenceRef["kind"][];
}>[] = [
  { observationId: "functional", evidenceKinds: ["api"] },
  { observationId: "keyboard", evidenceKinds: ["keyboard", "dom"] },
  { observationId: "axe", evidenceKinds: ["axe"] },
  { observationId: "console", evidenceKinds: [CONSOLE_KIND] },
  { observationId: "page-error", evidenceKinds: [PAGE_ERROR_KIND] },
  { observationId: "network", evidenceKinds: [REQUEST_KIND] },
  { observationId: "visual", evidenceKinds: ["screenshot", "geometry"] },
];
const EMPTY_BUNDLE: EvidenceBundle = {
  before: [],
  action: [],
  after: [],
  observations: [],
  inapplicable: [],
};

export type FrozenCaseEvidence = Readonly<
  Partial<Record<EvidencePhase, EvidenceBundle>>
>;

export type PhaseEvidence = Readonly<{
  readonly phase: EvidencePhase;
  readonly bundle: EvidenceBundle;
  readonly refs: readonly EvidenceRef[];
}>;

export const phaseEvidence = (
  evidence: FrozenCaseEvidence,
): readonly PhaseEvidence[] =>
  PHASES.map((phase) => {
    const bundle = evidence[phase] ?? EMPTY_BUNDLE;
    return { phase, bundle, refs: bundle[phase] };
  });

export const allRefs = (
  phases: readonly PhaseEvidence[],
): readonly EvidenceRef[] => phases.flatMap(({ refs }) => refs);

const phaseKindIssues = (
  caseId: string,
  phase: PhaseEvidence,
): readonly string[] =>
  Object.entries(REQUIRED_PHASE_KINDS).flatMap(([dimension, kinds]) =>
    kinds
      .filter(
        (kind) =>
          !phase.refs.some(
            (ref) => ref.kind === kind && ref.dimension === dimension,
          ),
      )
      .map((kind) => `${caseId} ${phase.phase} evidence is missing ${kind}`),
  );

const referencedKinds = (
  ids: readonly string[],
  refs: readonly EvidenceRef[],
): ReadonlySet<EvidenceRef["kind"]> =>
  new Set(
    ids.flatMap((id) => {
      const ref = refs.find(({ artifactId }) => artifactId === id);
      return ref === undefined ? [] : [ref.kind];
    }),
  );

const observationIssues = (
  caseId: string,
  phase: PhaseEvidence,
): readonly string[] =>
  REQUIRED_OBSERVATIONS.flatMap(({ observationId, evidenceKinds }) => {
    const observations = phase.bundle.observations.filter(
      ({ observationId: currentId }) => currentId === observationId,
    );
    const missingObservation =
      observations.length === 0
        ? [`${caseId} ${phase.phase} observation ${observationId} is missing`]
        : [];
    const observationEvidence = observations.flatMap((observation) => {
      const kinds = referencedKinds(observation.evidenceIds, phase.refs);
      return evidenceKinds
        .filter((kind) => !kinds.has(kind))
        .map(
          (kind) =>
            `${caseId} ${phase.phase} observation ${observationId} is missing ${kind} evidence link`,
        );
    });
    const failed = observations
      .filter(
        ({ outcome }) =>
          outcome === "fail" &&
          ["functional", "keyboard", "axe", "visual"].includes(observationId),
      )
      .map(
        ({ message }) =>
          `${caseId} ${phase.phase} observation ${observationId} failed: ${message}`,
      );
    return [...missingObservation, ...observationEvidence, ...failed];
  });

export const phaseIssues = (
  caseId: string,
  phase: PhaseEvidence,
): readonly string[] => [
  ...phaseKindIssues(caseId, phase),
  ...observationIssues(caseId, phase),
];

export const identityIssues = (
  matrixCase: MatrixExecutableCase,
  refs: readonly EvidenceRef[],
): readonly string[] =>
  refs.flatMap((ref) => {
    const fields: readonly (readonly [string, boolean])[] = [
      ["cell id", ref.cellId === matrixCase.caseId],
      ["source SHA", ref.sourceSha === matrixCase.sourceSha],
      ["profile", ref.profile === matrixCase.profile],
      ["role", ref.role === matrixCase.role],
      ["catalog route", ref.catalogRoute === matrixCase.catalogRoute],
      ["resolved route", ref.resolvedRoute === matrixCase.resolvedRoute],
    ];
    return fields
      .filter(([, matches]) => !matches)
      .map(
        ([field]) =>
          `${matrixCase.caseId} evidence ${ref.artifactId} has mismatched ${field}`,
      );
  });
