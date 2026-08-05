import type {
  DOMControl,
  EvidenceBundle,
  EvidenceDimension,
  EvidenceRef,
} from "./contracts.ts";
import type { EvidencePhase } from "./evidence-types.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import type { RuntimeSurfaceExpectation } from "./runtime-surface-expectation.ts";

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

export const controlIssues = (
  matrixCase: MatrixExecutableCase,
  controls: readonly DOMControl[],
  refs: readonly EvidenceRef[],
  surface?: RuntimeSurfaceExpectation,
): readonly string[] => {
  const action =
    "action" in matrixCase.execution ? matrixCase.execution.action : undefined;
  const duplicateKeys = controls
    .map(({ controlKey }) => controlKey)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  const identity = controls.flatMap((control) => [
    ...(control.cellId === matrixCase.caseId
      ? []
      : [
          `${matrixCase.caseId} control ${control.controlKey} has cell id ${control.cellId}`,
        ]),
    ...(control.accessibleName.trim() === ""
      ? [
          `${matrixCase.caseId} control ${control.controlKey} has no accessible name`,
        ]
      : []),
    ...(control.actionResult.kind === "exercised"
      ? control.actionResult.evidenceIds
          .filter((id) => !refs.some(({ artifactId }) => artifactId === id))
          .map(
            (id) =>
              `${matrixCase.caseId} control ${control.controlKey} references missing evidence ${id}`,
          )
      : []),
  ]);
  const duplicateIssues = duplicateKeys.map(
    (key) => `${matrixCase.caseId} has duplicate control ${key}`,
  );
  const targetIssues =
    action === undefined ||
    action.operation === "navigate" ||
    !["control", "recovery"].includes(matrixCase.execution.kind)
      ? []
      : controls.some(({ controlKey }) => controlKey === action.controlKey)
        ? controls
            .filter(({ controlKey }) => controlKey === action.controlKey)
            .flatMap((control) =>
              control.actionResult.kind === "not-exercised" &&
              !(
                control.actionResult.policy === "inapplicable" &&
                surface?.productActions === "inapplicable"
              )
                ? [
                    `${matrixCase.caseId} frozen control ${action.controlKey} was not exercised: ${control.actionResult.reason}`,
                  ]
                : [],
            )
        : [
            `${matrixCase.caseId} is missing frozen control ${action.controlKey}`,
          ];
  return [...identity, ...duplicateIssues, ...targetIssues];
};

type OracleRequirement = Readonly<{ readonly kind: "api" | "db" }>;

const oracleForExecution = (
  matrixCase: MatrixExecutableCase,
): OracleRequirement | undefined =>
  matrixCase.execution.kind === "infrastructure" &&
  "observation" in matrixCase.execution
    ? { kind: matrixCase.execution.observation.kind }
    : ["recovery", "fault", "concurrency"].includes(matrixCase.execution.kind)
      ? { kind: "db" }
      : undefined;

const controlActionIssues = (
  matrixCase: MatrixExecutableCase,
  refs: readonly EvidenceRef[],
): readonly string[] => {
  const needsControlAction =
    "action" in matrixCase.execution &&
    !["navigation", "idle"].includes(matrixCase.execution.kind);
  return needsControlAction &&
    !refs.some(({ kind }) => kind === "control-action")
    ? [`${matrixCase.caseId} action evidence is missing control-action`]
    : [];
};

const oracleIssues = (
  matrixCase: MatrixExecutableCase,
  refs: readonly EvidenceRef[],
  oracle: OracleRequirement | undefined,
): readonly string[] => {
  if (oracle === undefined || refs.some(({ kind }) => kind === oracle.kind))
    return [];
  return [
    oracle.kind === "db"
      ? `${matrixCase.caseId} requires database oracle evidence for ${matrixCase.execution.kind} execution`
      : `${matrixCase.caseId} requires ${oracle.kind} infrastructure observation evidence`,
  ];
};

const cleanupIssues = (
  caseId: string,
  refs: readonly EvidenceRef[],
  oracle: OracleRequirement | undefined,
): readonly string[] => {
  if (
    oracle === undefined ||
    refs.some(
      ({ archivePath }) =>
        archivePath.includes("/after/") &&
        archivePath.toLowerCase().includes("cleanup"),
    )
  )
    return [];
  return [`${caseId} requires runtime cleanup evidence`];
};

const transitionIssues = (
  matrixCase: MatrixExecutableCase,
  actionTransition: string,
): readonly string[] =>
  matrixCase.state.controlTransition === actionTransition
    ? []
    : [
        `${matrixCase.caseId} state transition ${matrixCase.state.controlTransition} does not match action transition ${actionTransition}`,
      ];

export const caseSpecificIssues = (
  matrixCase: MatrixExecutableCase,
  phases: readonly PhaseEvidence[],
  actionTransition: string,
): readonly string[] => {
  const refs = allRefs(phases);
  const oracle = oracleForExecution(matrixCase);
  return [
    ...controlActionIssues(matrixCase, refs),
    ...oracleIssues(matrixCase, refs, oracle),
    ...cleanupIssues(matrixCase.caseId, refs, oracle),
    ...transitionIssues(matrixCase, actionTransition),
  ];
};
