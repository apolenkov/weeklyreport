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

const observationEvidenceKinds = (
  observationId: string,
): readonly EvidenceRef["kind"][] =>
  observationId === "keyboard"
    ? ["keyboard", "dom"]
    : observationId === "visual"
      ? ["geometry", "screenshot"]
      : observationId === "network"
        ? ["request"]
        : observationId === "functional"
          ? ["api"]
          : observationId === "console"
            ? ["console"]
            : observationId === "page-error"
              ? ["page-error"]
              : observationId === "axe"
                ? ["axe"]
                : [];

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

const bundle = (
  phase: "before" | "action" | "after",
  omit: readonly EvidenceRef["kind"][] = [],
): EvidenceBundle => {
  const refs = REF_SPECS.filter(([kind]) => !omit.includes(kind)).map(
    ([kind, dimension]) => ref(phase, kind, dimension),
  );
  const byKind = (kind: EvidenceRef["kind"]): string =>
    refs.find((candidate) => candidate.kind === kind)?.artifactId ?? "missing";
  return evidenceBundleSchema.parse({
    before: phase === "before" ? refs : [],
    action: phase === "action" ? refs : [],
    after: phase === "after" ? refs : [],
    observations: observationSpecs.map(({ observationId, kind }) => ({
      observationId,
      kind,
      outcome: "pass",
      message: `${observationId} passed`,
      evidenceIds: observationEvidenceKinds(observationId).map(byKind),
    })),
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

test("emits one cell with the frozen case id and complete phase evidence", () => {
  const result = replayFrozenCase(matrixCase(), input());

  expect(result.cell.cellId).toBe("case-control-submit");
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
  expect(result.cell.verdict).toBe("fail");
  expect(result.issues).toContain(
    "case-control-submit action evidence is missing keyboard",
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
