import type {
  Action,
  CoverageCell,
  CoverageVerdict,
  EvidenceDimension,
  EvidenceKind,
  EvidenceRef,
  Oracle,
  StateAxes,
} from "../source/contracts.ts";

const SOURCE_SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;
export const SOURCE_SHA = "a".repeat(SOURCE_SHA_LENGTH);
const DIGEST = "b".repeat(DIGEST_LENGTH);
const REPORT_ROUTE = "/lead/report";

const state: StateAxes = {
  profileCapability: "canonical-identities",
  lifecycle: "open",
  submission: "draft",
  ownershipDensity: "single",
  permission: "allowed",
  fault: "none",
  controlTransition: "none",
};

const action: Action = {
  controlKey: "save",
  operation: "click",
  safety: "reversible",
  transition: "none",
};

const oracle: Oracle = {
  domainSpecRefs: ["exhaustive-runtime-sweep"],
  function: { required: true, expectation: "the action succeeds" },
  accessibility: { required: true, expectation: "status is announced" },
  visual: { required: true, expectation: "settled screenshot matches" },
  runtime: { required: true, expectation: "runtime telemetry is clean" },
};

export const control = {
  controlKey: "save",
  cellId: "cell-a",
  ariaRole: "button",
  accessibleName: "Save",
  enabled: true,
  order: 0,
  actionResult: {
    kind: "exercised" as const,
    result: "pass" as const,
    evidenceIds: ["function-artifact"],
  },
};

function evidence(
  dimension: EvidenceDimension,
  kind: EvidenceKind,
  artifactId: string,
  cellId = "cell-a",
): EvidenceRef {
  return {
    artifactId,
    kind,
    dimension,
    archivePath: `baseline/${artifactId}`,
    digest: DIGEST,
    capturedAt: "2026-08-04T00:00:00Z",
    cellId,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: REPORT_ROUTE,
    resolvedRoute: REPORT_ROUTE,
  };
}

export function makeCell(
  cellId = "cell-a",
  verdict: CoverageVerdict = "pass",
): CoverageCell {
  const functionRef = evidence("function", "api", "function-artifact", cellId);
  const accessibilityRef = evidence(
    "accessibility",
    "axe",
    "accessibility-artifact",
    cellId,
  );
  const visualRef = evidence("visual", "screenshot", "visual-artifact", cellId);
  const runtimeRef = evidence("runtime", "log", "runtime-artifact", cellId);
  return {
    cellId,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: REPORT_ROUTE,
    resolvedRoute: REPORT_ROUTE,
    viewport: { browser: "chromium", width: 1440, height: 900 },
    state,
    action,
    execution: { kind: "control", action },
    faultId: null,
    oracle,
    controls: [{ ...control, cellId }],
    evidence: {
      before: [functionRef],
      action: [accessibilityRef],
      after: [visualRef, runtimeRef],
      observations: [],
      inapplicable: [],
    },
    verdict,
  };
}

export const options = {
  sourceSha: SOURCE_SHA,
  expectedCellIds: ["cell-a", "cell-b"],
  requireFinalPass: true,
};
