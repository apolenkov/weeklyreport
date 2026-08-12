import { describe, expect, it } from "vitest";

import {
  revealPathFor,
  revealSurfaceFor,
} from "../../preflight/reveal-path.ts";
import {
  type Action,
  type CoverageCell,
  coverageCellSchema,
  type MatrixAxes,
  type MatrixExecution,
  NO_ROUTE_CACHE_CONTRACT_POLICY,
} from "../../source/contracts.ts";
import { sha256Hex } from "../../support/ids.ts";
import { pairKeys } from "../finalization/matrix-finalizer-support.ts";
import {
  type FrozenMatrix,
  type MatrixExecutableCase,
  parseFrozenMatrix,
} from "../matrix-finalizer.ts";
import {
  assertFrozenMatrixCoverage,
  FrozenMatrixCoverageError,
  verifyFrozenMatrixCoverage,
} from "./matrix-coverage.ts";

const SOURCE_SHA = "a".repeat(40);
const VIEWPORT = { browser: "chromium" as const, width: 1440, height: 900 };
const fixturePath = revealPathFor([], "/lead");
const fixtureSurface = revealSurfaceFor(
  ["publish", "submit"].map((controlKey, index) => ({
    controlKey,
    ariaRole: "button",
    accessibleName: controlKey,
    enabled: true,
    order: index,
    domOrderKey: `${String(index).padStart(4, "0")}:button:${controlKey}`,
    href: null,
    interactionEffect: null,
  })),
);
const state = (
  overrides: Partial<MatrixAxes> = {},
): MatrixExecutableCase["state"] => ({
  profileCapability: "canonical-identities",
  lifecycle: "open",
  submission: "draft",
  ownershipDensity: "single",
  permission: "allowed",
  fault: "none",
  controlTransition: "none",
  ...overrides,
});
const action = (
  controlKey: string,
  operation: Action["operation"],
  transition: Action["transition"] = "none",
): Action => ({ controlKey, operation, safety: "reversible", transition });
const matrixCase = (
  caseId: string,
  axes: MatrixExecutableCase["state"],
  execution: MatrixExecution,
): MatrixExecutableCase => {
  const action =
    "action" in execution && execution.kind !== "navigation"
      ? execution.action
      : undefined;
  return {
    kind: "executable",
    caseId,
    stateId: `${caseId}-state`,
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead",
    resolvedRoute: "/lead",
    networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
    state: axes,
    execution,
    ...(action === undefined
      ? {}
      : {
          controlKey: action.controlKey,
          preparation: {
            revealPathDigest: fixturePath.digest,
            expectedSurfaceDigest: fixtureSurface.digest,
            expectedActionTransitionDigest: null,
          },
        }),
  };
};
const navigation = (caseId: string, axes = state()): MatrixExecutableCase =>
  matrixCase(caseId, axes, {
    kind: "navigation",
    action: {
      controlKey: "route:lead:/lead",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  });
const control = (caseId: string): MatrixExecutableCase =>
  matrixCase(caseId, state({ controlTransition: "submit" }), {
    kind: "control",
    action: action("submit", "submit", "submit"),
  });
const fault = (caseId: string): MatrixExecutableCase =>
  matrixCase(
    caseId,
    state({ fault: "http-5xx", controlTransition: "publish" }),
    {
      kind: "fault",
      action: action("publish", "publish", "publish"),
      faultId: "publish-http-5xx",
    },
  );

const inapplicable = (caseId: string) => ({
  kind: "inapplicable" as const,
  caseId,
  stateId: `${caseId}-state`,
  sourceSha: SOURCE_SHA,
  profile: "minimal" as const,
  role: "lead" as const,
  catalogRoute: "/lead",
  resolvedRoute: "/lead",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: state({ fault: "network-timeout" }),
  inapplicable: {
    constraintId: "fixture-boundary",
    reason: "fixture does not expose a timeout target",
  },
});

const expectedAction = (matrixCase: MatrixExecutableCase): Action =>
  "action" in matrixCase.execution
    ? matrixCase.execution.action
    : {
        controlKey: `observation:${matrixCase.execution.observation.observationId}`,
        operation: "navigate",
        safety: "read-only",
        transition: matrixCase.execution.kind === "idle" ? "idle" : "none",
      };

const cellFor = (
  matrixCase: MatrixExecutableCase,
  overrides: Partial<CoverageCell> = {},
): CoverageCell =>
  coverageCellSchema.parse({
    cellId: matrixCase.caseId,
    sourceSha: SOURCE_SHA,
    profile: matrixCase.profile,
    role: matrixCase.role,
    catalogRoute: matrixCase.catalogRoute,
    resolvedRoute: matrixCase.resolvedRoute,
    viewport: VIEWPORT,
    state: matrixCase.state,
    action: expectedAction(matrixCase),
    execution: matrixCase.execution,
    faultId:
      "faultId" in matrixCase.execution ? matrixCase.execution.faultId : null,
    oracle: {
      domainSpecRefs: ["fixture"],
      function: { required: true, expectation: "fixture" },
      accessibility: { required: true, expectation: "fixture" },
      visual: { required: true, expectation: "fixture" },
      runtime: { required: true, expectation: "fixture runtime is clean" },
    },
    controls: [],
    evidence: {
      before: [],
      action: [],
      after: [],
      observations: [],
      inapplicable: [],
    },
    verdict: "pending",
    ...overrides,
  });

const frozen = (
  cases: readonly MatrixExecutableCase[],
  inapplicableRows: readonly ReturnType<typeof inapplicable>[] = [],
): FrozenMatrix => {
  const body = {
    version: 1 as const,
    sourceSha: SOURCE_SHA,
    viewport: VIEWPORT,
    generatorSeed: "fixture",
    rows: [...cases, ...inapplicableRows],
    cases,
    inapplicable: inapplicableRows,
    coveredPairs: [...new Set(cases.flatMap(pairKeys))].toSorted(),
    counts: {
      executable: cases.length,
      inapplicable: inapplicableRows.length,
      total: cases.length + inapplicableRows.length,
    },
    limits: {
      maxCases: Math.max(100, cases.length + inapplicableRows.length),
      maxControlsPerSegment: 10,
    },
    revealPaths: [fixturePath],
    revealSurfaces: [fixtureSurface],
    revealTransitions: [],
  };
  return parseFrozenMatrix({ ...body, digest: sha256Hex(body) });
};

describe("frozen MATRIX coverage", () => {
  it("accepts cells whose identities and order equal executable MATRIX rows", () => {
    const cases = [
      navigation("case-navigation"),
      control("case-control"),
      fault("case-fault"),
    ];
    const matrix = frozen(cases);
    const cells = cases.map((entry) => cellFor(entry));

    expect(verifyFrozenMatrixCoverage(matrix, cells)).toEqual([]);
    expect(() => assertFrozenMatrixCoverage(matrix, cells)).not.toThrow();
  });

  it("rejects missing specialized rows and does not let a nominal witness cover them", () => {
    const cases = [
      navigation("case-navigation"),
      control("case-control"),
      matrixCase("case-publish-nominal", state(), {
        kind: "control",
        action: action("publish", "publish", "none"),
      }),
      fault("case-fault"),
    ];
    const cells = cases.slice(0, 3).map((entry) => cellFor(entry));
    const gaps = verifyFrozenMatrixCoverage(frozen(cases), cells);

    expect(gaps.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["missing-specialized-case", "pair-gap"]),
    );
    expect(gaps.some(({ kind }) => kind === "fabricated-none-witness")).toBe(
      true,
    );
  });

  it("rejects duplicate, extra, and typed-inapplicable emitted rows", () => {
    const nominal = navigation("case-navigation");
    const canonicalControl = control("case-control");
    const excluded = inapplicable("case-excluded");
    const matrix = frozen([nominal, canonicalControl], [excluded]);
    const duplicate = cellFor(nominal);
    const extra = cellFor(nominal, { cellId: "case-extra" });
    const excludedCell = cellFor(nominal, { cellId: excluded.caseId });
    const gaps = verifyFrozenMatrixCoverage(matrix, [
      duplicate,
      extra,
      extra,
      duplicate,
      excludedCell,
    ]);

    expect(
      gaps
        .filter(({ kind }) => kind === "duplicate-case")
        .map(({ caseId }) => caseId),
    ).toEqual([extra.cellId, nominal.caseId]);
    expect(gaps.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining([
        "duplicate-case",
        "extra-case",
        "inapplicable-case",
        "missing-specialized-case",
      ]),
    );
  });

  it("rejects execution, action, transition, and fault identity drift", () => {
    const matrixCase = fault("case-fault");
    if (matrixCase.execution.kind !== "fault")
      throw new Error("fixture fault case is not a fault");
    const cell = cellFor(matrixCase, {
      state: { ...matrixCase.state, fault: "none", controlTransition: "none" },
      action: action("publish", "publish", "none"),
      execution: { ...matrixCase.execution, faultId: "other-fault" },
      faultId: "other-fault",
    });
    const gaps = verifyFrozenMatrixCoverage(frozen([matrixCase]), [cell]);

    expect(
      gaps.filter(({ kind }) => kind === "identity-mismatch").length,
    ).toBeGreaterThanOrEqual(4);
    expect(gaps.some(({ kind }) => kind === "fabricated-none-witness")).toBe(
      true,
    );
    expect(() =>
      assertFrozenMatrixCoverage(frozen([matrixCase]), [cell]),
    ).toThrow(FrozenMatrixCoverageError);
  });

  it("verifies a large complete matrix without repeated cell scans", () => {
    const cases = Array.from({ length: 8192 }, (_, index) =>
      navigation(`case-large-${index}`),
    );
    const cells = cases.map((entry) => cellFor(entry));

    expect(verifyFrozenMatrixCoverage(frozen(cases), cells)).toEqual([]);
  });
});
