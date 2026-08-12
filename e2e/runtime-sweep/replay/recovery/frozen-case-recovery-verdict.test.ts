import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import {
  type EvidenceBundle,
  evidenceBundleSchema,
  type EvidenceRef,
  evidenceRefSchema,
  NO_ROUTE_CACHE_CONTRACT_POLICY,
  type Oracle,
} from "../../source/contracts.ts";
import { replayFrozenCase } from "../evidence/frozen-case-evidence.ts";

const SOURCE_SHA = "a".repeat(40);
const CASE_ID = "case-recovery-verdict";
const ORACLE: Oracle = {
  domainSpecRefs: ["openspec/spec.md"],
  function: { required: true, expectation: "action succeeds" },
  accessibility: { required: true, expectation: "controls remain usable" },
  visual: { required: true, expectation: "geometry is reviewed" },
  runtime: { required: true, expectation: "runtime telemetry is clean" },
};

const matrixCase: MatrixExecutableCase = {
  caseId: CASE_ID,
  stateId: "state-recovery-verdict",
  sourceSha: SOURCE_SHA,
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "owner",
    fault: "none",
    controlTransition: "submit",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:Submit:1",
      operation: "submit",
      safety: "irreversible",
      transition: "submit",
    },
  },
};

type Phase = "before" | "action" | "after";
type RefSpec = readonly [EvidenceRef["kind"], EvidenceRef["dimension"]];
type ObservationSpec = readonly [
  string,
  EvidenceBundle["observations"][number]["kind"],
  readonly EvidenceRef["kind"][],
];
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
];

const ref = (
  phase: Phase,
  kind: EvidenceRef["kind"],
  dimension: EvidenceRef["dimension"],
  suffix: string = kind,
): EvidenceRef =>
  evidenceRefSchema.parse({
    artifactId: `${phase}-${suffix}`,
    kind,
    dimension,
    archivePath: `/archive/${phase}/${suffix}.json`,
    digest: "b".repeat(64),
    capturedAt: "2026-08-08T00:00:00.000Z",
    cellId: CASE_ID,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report",
    resolvedRoute: "/lead/report",
  });

const requiredObservations = (phase: Phase): EvidenceBundle["observations"] =>
  (
    [
      ["functional", "api", ["api"]],
      ["keyboard", "keyboard", ["keyboard", "dom"]],
      ["axe", "axe", ["axe"]],
      ["console", "console", ["console"]],
      ["page-error", "page-error", ["page-error"]],
      ["network", "network", ["request"]],
      ["server-log", "api", ["log"]],
      ["visual", "geometry", ["geometry", "screenshot"]],
    ] satisfies readonly ObservationSpec[]
  ).map(([observationId, kind, evidenceKinds]) => ({
    observationId,
    kind,
    outcome: "pass" as const,
    message: `${observationId} passed`,
    evidenceIds: evidenceKinds.map(
      (evidenceKind) => `${phase}-${evidenceKind}`,
    ),
  }));

const phaseBundle = (
  phase: Phase,
  recovery: "pass" | "fail" | "missing",
): EvidenceBundle => {
  const baseRefs = REF_SPECS.map(([kind, dimension]) =>
    ref(phase, kind, dimension),
  );
  const actionRefs =
    phase === "action"
      ? [
          ref(phase, "control-action", "runtime"),
          ...(recovery === "missing"
            ? []
            : [ref(phase, "log", "runtime", "recovery-evidence")]),
        ]
      : [];
  const transitionRef =
    phase === "after"
      ? [ref(phase, "geometry", "visual", "transition-visual")]
      : [];
  const refs = [...baseRefs, ...actionRefs, ...transitionRef];
  const recoveryObservation =
    phase === "action" && recovery !== "missing"
      ? [
          {
            observationId: "action-recovery",
            kind: "api" as const,
            outcome: recovery,
            message: `Recovery ${recovery}`,
            evidenceIds: ["action-recovery-evidence"],
          },
        ]
      : [];
  const transitionObservation =
    phase === "after"
      ? [
          {
            observationId: "transition-visual",
            kind: "geometry" as const,
            outcome: "pass" as const,
            message: "Transition visual passed",
            evidenceIds: [
              "before-screenshot",
              "before-geometry",
              "after-screenshot",
              "after-geometry",
              "after-transition-visual",
            ],
          },
        ]
      : [];
  return evidenceBundleSchema.parse({
    before: phase === "before" ? refs : [],
    action: phase === "action" ? refs : [],
    after: phase === "after" ? refs : [],
    observations: [
      ...requiredObservations(phase),
      ...recoveryObservation,
      ...transitionObservation,
    ],
    inapplicable: [],
  });
};

const replay = (recovery: "pass" | "fail" | "missing") =>
  replayFrozenCase(matrixCase, {
    caseId: CASE_ID,
    oracle: ORACLE,
    controls: [
      {
        controlKey: "button:Submit:1",
        cellId: CASE_ID,
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
      before: phaseBundle("before", recovery),
      action: phaseBundle("action", recovery),
      after: phaseBundle("after", recovery),
    },
  });

describe("frozen recovery verdict", () => {
  it("passes when the product action and recovery both pass", () => {
    expect(replay("pass").cell.verdict).toBe("pass");
  });

  it("fails a passing product action when recovery fails", () => {
    const result = replay("fail");
    expect(result.cell.verdict).toBe("fail");
    expect(result.issues).toContain(
      `${CASE_ID} action observation action-recovery failed: Recovery fail`,
    );
  });

  it("fails when a stateful action omits recovery evidence", () => {
    expect(replay("missing").issues).toContain(
      `${CASE_ID} action requires exactly one recovery observation`,
    );
  });
});
