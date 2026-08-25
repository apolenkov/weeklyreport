import { expect, test } from "vitest";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import type {
  EvidenceBundle,
  EvidenceRef,
  Oracle,
} from "../../source/contracts.ts";
import {
  evidenceBundleSchema,
  evidenceRefSchema,
} from "../../source/contracts.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../source/contracts.ts";
import {
  type FrozenCaseReplayInput,
  replayFrozenCase,
} from "./frozen-case-evidence.ts";

const SOURCE_SHA = "a".repeat(40);
const ORACLE: Oracle = {
  domainSpecRefs: ["openspec/spec.md"],
  function: { required: true, expectation: "state matches" },
  accessibility: { required: true, expectation: "controls are usable" },
  visual: { required: true, expectation: "geometry is stable" },
  runtime: { required: true, expectation: "runtime telemetry is clean" },
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
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
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

const failObservation = (
  source: EvidenceBundle,
  observationId: string,
  message: string,
): EvidenceBundle => ({
  ...source,
  observations: source.observations.map((observation) =>
    observation.observationId === observationId
      ? { ...observation, outcome: "fail", message }
      : observation,
  ),
});

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

test("emits one cell with the frozen case id and complete phase evidence", () => {
  const result = replayFrozenCase(matrixCase(), input());

  expect(result.cell.verdict).toBe("pass");
  expect(result.issues).toEqual([]);
});

test("fails the owning cell when a required phase artifact is missing", () => {
  const result = replayFrozenCase(
    matrixCase(),
    input({
      evidence: {
        before: bundle("before"),
        action: bundle("action", ["keyboard"]),
        after: bundle("after"),
      },
    }),
  );

  expect(result.cell.cellId).toBe("case-control-submit");
  expect(result.issues).toContain(
    "case-control-submit action evidence is missing keyboard",
  );
});

test("fails the owning cell for a transport failure consumed at a phase boundary", () => {
  const dirtyAction = failObservation(
    bundle("action"),
    "network",
    "transport failure observed at the action boundary",
  );
  const result = replayFrozenCase(
    matrixCase(),
    input({
      evidence: {
        before: bundle("before"),
        action: dirtyAction,
        after: bundle("after"),
      },
    }),
  );

  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "case-control-submit action observation network failed: transport failure observed at the action boundary",
  );
});

test("fails the owning cell when paired transition geometry is dirty", () => {
  const dirtyAfter = failObservation(
    bundle("after"),
    "transition-visual",
    "stable report toolbar moved by 24px",
  );
  const result = replayFrozenCase(
    matrixCase(),
    input({
      evidence: {
        before: bundle("before"),
        action: bundle("action"),
        after: dirtyAfter,
      },
    }),
  );

  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "case-control-submit transition-visual failed: stable report toolbar moved by 24px",
  );
});

test("fails the owning cell when the caller supplies a legacy cell id", () => {
  const result = replayFrozenCase(
    matrixCase(),
    input({ cellId: "lead-minimal-lead-report-navigation" }),
  );

  expect(result.cell.cellId).toBe("case-control-submit");
  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "supplied cell id lead-minimal-lead-report-navigation does not equal frozen case case-control-submit",
  );
});

test("fails the owning cell when replay input is keyed to another frozen case", () => {
  const result = replayFrozenCase(
    matrixCase(),
    input({ caseId: "case-substituted-state" }),
  );

  expect(result.cell.cellId).toBe("case-control-submit");
  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "supplied case id case-substituted-state does not equal frozen case case-control-submit",
  );
});

test("fails the owning cell when the frozen control is absent", () => {
  const result = replayFrozenCase(matrixCase(), input({ controls: [] }));

  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "case-control-submit is missing frozen control button:submit",
  );
});
