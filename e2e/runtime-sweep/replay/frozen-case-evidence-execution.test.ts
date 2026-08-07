import { expect, test } from "vitest";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import type {
  EvidenceBundle,
  EvidenceRef,
  Oracle,
} from "../source/contracts.ts";
import {
  evidenceBundleSchema,
  evidenceRefSchema,
} from "../source/contracts.ts";
import {
  type FrozenCaseReplayInput,
  replayFrozenCase,
  replayFrozenCases,
} from "./frozen-case-evidence.ts";

const SOURCE_SHA = "a".repeat(40);
const ORACLE: Oracle = {
  domainSpecRefs: ["openspec/spec.md"],
  function: { required: true, expectation: "state matches" },
  accessibility: { required: true, expectation: "controls are usable" },
  visual: { required: true, expectation: "geometry is stable" },
};

const state: MatrixExecutableCase["state"] = {
  profileCapability: "editable-active-report",
  lifecycle: "open",
  submission: "draft",
  ownershipDensity: "single",
  permission: "allowed",
  fault: "none",
  controlTransition: "submit",
};

const matrixCase = (): MatrixExecutableCase => ({
  caseId: "case-control-submit",
  stateId: "state-control-submit",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  state,
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:submit",
      operation: "submit",
      safety: "reversible",
      transition: "submit",
    },
  },
});

const OBSERVATION_EVIDENCE_KINDS: Readonly<
  Record<string, readonly EvidenceRef["kind"][]>
> = {
  keyboard: ["keyboard", "dom"],
  visual: ["geometry", "screenshot"],
  network: ["request"],
  functional: ["api"],
  console: ["console"],
  "page-error": ["page-error"],
  axe: ["axe"],
  "server-log": ["log"],
};

const observationEvidenceKinds = (
  observationId: string,
): readonly EvidenceRef["kind"][] =>
  OBSERVATION_EVIDENCE_KINDS[observationId] ?? [];

const observationSpecs: readonly Readonly<{
  readonly observationId: string;
  readonly kind: EvidenceBundle["observations"][number]["kind"];
}>[] = [
  { observationId: "functional", kind: "api" },
  { observationId: "keyboard", kind: "keyboard" },
  { observationId: "axe", kind: "axe" },
  { observationId: "console", kind: "console" },
  { observationId: "page-error", kind: "page-error" },
  { observationId: "network", kind: "network" },
  { observationId: "server-log", kind: "api" },
  { observationId: "visual", kind: "geometry" },
];

type RefSpec = readonly [EvidenceRef["kind"], EvidenceRef["dimension"]];
const REF_SPECS: readonly RefSpec[] = [
  ["dom", "accessibility"],
  ["axe", "accessibility"],
  ["keyboard", "accessibility"],
  ["api", "function"],
  ["console", "runtime"],
  ["page-error", "runtime"],
  ["request", "runtime"],
  ["url", "runtime"],
  ["log", "runtime"],
  ["screenshot", "visual"],
  ["geometry", "visual"],
  ["control-action", "runtime"],
];

const ref = (
  phase: "before" | "action" | "after",
  kind: EvidenceRef["kind"],
  dimension: EvidenceRef["dimension"],
): EvidenceRef =>
  evidenceRefSchema.parse({
    artifactId: `${phase}-${kind}`,
    kind,
    dimension,
    archivePath: `/archive/${phase}/${kind}.json`,
    digest: "b".repeat(64),
    capturedAt: "2026-08-04T00:00:00.000Z",
    cellId: "case-control-submit",
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
  });

const transitionPairRef = (): EvidenceRef =>
  evidenceRefSchema.parse({
    ...ref("after", "geometry", "visual"),
    artifactId: "after-transition-visual",
    archivePath: "/archive/after/transition-visual.json",
  });

const bundle = (
  phase: "before" | "action" | "after",
  omit: readonly EvidenceRef["kind"][] = [],
): EvidenceBundle => {
  const refs = [
    ...REF_SPECS.filter(([kind]) => !omit.includes(kind)).map(
      ([kind, dimension]) => ref(phase, kind, dimension),
    ),
    ...(phase === "after" ? [transitionPairRef()] : []),
  ];
  const byKind = (kind: EvidenceRef["kind"]): string =>
    refs.find((candidate) => candidate.kind === kind)?.artifactId ?? "missing";
  return evidenceBundleSchema.parse({
    before: phase === "before" ? refs : [],
    action: phase === "action" ? refs : [],
    after: phase === "after" ? refs : [],
    observations: [
      ...observationSpecs.map(({ observationId, kind }) => ({
        observationId,
        kind,
        outcome: "pass" as const,
        message: `${observationId} passed`,
        evidenceIds: observationEvidenceKinds(observationId).map(byKind),
      })),
      ...(phase === "after"
        ? [
            {
              observationId: "transition-visual",
              kind: "geometry" as const,
              outcome: "pass" as const,
              message: "transition visual passed",
              evidenceIds: [
                "before-screenshot",
                "before-geometry",
                "after-screenshot",
                "after-geometry",
                "after-transition-visual",
              ],
            },
          ]
        : []),
    ],
    inapplicable: [],
  });
};

const input = (
  overrides: Partial<FrozenCaseReplayInput> = {},
): FrozenCaseReplayInput => ({
  caseId: "case-control-submit",
  oracle: ORACLE,
  controls: [
    {
      controlKey: "button:submit",
      cellId: "case-control-submit",
      ariaRole: "button",
      accessibleName: "Submit",
      enabled: true,
      order: 0,
      actionResult: {
        kind: "exercised",
        result: "pass",
        evidenceIds: ["action-control-action"],
      },
    },
  ],
  evidence: {
    before: bundle("before"),
    action: bundle("action"),
    after: bundle("after"),
  },
  ...overrides,
});

test("fails applicable fault cases without a database oracle", () => {
  const faultCase: MatrixExecutableCase = {
    caseId: "case-fault-submit",
    stateId: "state-fault-submit",
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
    state: { ...state, fault: "api-error" },
    kind: "executable",
    execution: {
      kind: "fault",
      faultId: "api-error-submit",
      action: {
        controlKey: "button:submit",
        operation: "submit",
        safety: "reversible",
        transition: "submit",
      },
    },
  };
  const result = replayFrozenCase(
    faultCase,
    input({
      caseId: faultCase.caseId,
      evidence: {
        before: bundle("before"),
        action: bundle("action"),
        after: bundle("after"),
      },
    }),
  );

  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "case-fault-submit requires database oracle evidence for fault execution",
  );
});

test("requires the declared observation kind and cleanup proof for infrastructure cases", () => {
  const infrastructureCase: MatrixExecutableCase = {
    ...matrixCase(),
    caseId: "case-infrastructure-observation",
    stateId: "state-infrastructure-observation",
    state: { ...state, controlTransition: "none" },
    execution: {
      kind: "infrastructure",
      faultId: "smtp-transport-unavailable",
      observation: {
        observationId: "smtp-transport-unavailable",
        kind: "api",
      },
    },
  };
  const result = replayFrozenCase(
    infrastructureCase,
    input({
      caseId: infrastructureCase.caseId,
      evidence: {
        before: bundle("before", ["api"]),
        action: bundle("action", ["api"]),
        after: bundle("after", ["api"]),
      },
    }),
  );

  expect(result.issues).toContain(
    "case-infrastructure-observation requires api infrastructure observation evidence",
  );
  expect(result.issues).toContain(
    "case-infrastructure-observation requires runtime cleanup evidence",
  );
});

test("replays each frozen case into its own cell without route aggregation", () => {
  const secondCase: MatrixExecutableCase = {
    ...matrixCase(),
    caseId: "case-control-submit-second",
    stateId: "state-control-submit-second",
  };
  const results = replayFrozenCases(
    [matrixCase(), secondCase],
    [input(), input({ caseId: secondCase.caseId })],
  );

  expect(results).toHaveLength(2);
  expect(results.map(({ cell }) => cell.cellId)).toEqual([
    "case-control-submit",
    "case-control-submit-second",
  ]);
});
