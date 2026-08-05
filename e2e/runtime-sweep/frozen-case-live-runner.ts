import type { Page, TestInfo } from "@playwright/test";

import type { DOMControl } from "./contracts.ts";
import { inventoryDom } from "./dom-inventory.ts";
import {
  captureFrozenCasePhases,
  type CompleteFrozenCaseEvidence,
  type FrozenCaseCoverageCell,
} from "./frozen-case-evidence.ts";
import {
  controlsForCase,
  type FrozenCaseLiveRuntime,
  loginForCase,
  prepareCase,
  stateForCase,
} from "./frozen-case-live-actions.ts";
import {
  captureFrozenPhase,
  initialNavigation,
} from "./frozen-case-live-capture.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import {
  routeForState,
  RUNTIME_MATRIX_ORACLE,
  type RuntimeMatrixSource,
} from "./runtime-matrix.ts";
import { writeCell } from "./runtime-matrix-evidence.ts";
import { runSpecializedCase } from "./specialized-case-runner.ts";

export type { FrozenCaseLiveRuntime } from "./frozen-case-live-actions.ts";

const persistFrozenCaseCell = async (
  runtime: FrozenCaseLiveRuntime,
  cell: FrozenCaseCoverageCell,
): Promise<void> => {
  await writeCell(runtime.archiveRoot, cell);
};

const actionResultFor = (
  evidence: CompleteFrozenCaseEvidence,
): DOMControl["actionResult"] => {
  const actionRef = evidence.action.action.find(
    ({ kind }) => kind === "control-action",
  );
  if (actionRef === undefined)
    return {
      kind: "not-exercised",
      policy: "inapplicable",
      reason: "Frozen case has no bounded control action",
    };
  const functional = evidence.action.observations.find(
    ({ observationId }) => observationId === "functional",
  );
  return {
    kind: "exercised",
    result: functional?.outcome === "pass" ? "pass" : "fail",
    evidenceIds: [actionRef.artifactId],
  };
};

const runFrozenCase = async (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  testInfo: TestInfo,
): Promise<FrozenCaseCoverageCell> => {
  const browser = page.context().browser();
  if (browser === null)
    throw new Error(`Frozen case ${matrixCase.caseId} has no browser context`);
  const specialized = await runSpecializedCase({
    page,
    browser,
    baseURL: runtime.baseURL,
    repoRoot: runtime.repoRoot,
    archiveRoot: runtime.archiveRoot,
    matrixCase,
    oracle: RUNTIME_MATRIX_ORACLE,
    testInfo,
    capturedAt: new Date().toISOString(),
  });
  if (specialized !== undefined) {
    await persistFrozenCaseCell(runtime, specialized.cell);
    return specialized.cell;
  }
  const { prepared } = await prepareCase(source, matrixCase, runtime);
  await loginForCase(page, matrixCase);
  const route = routeForState(source, stateForCase(matrixCase));
  const navigation = await initialNavigation(page, route.resolvedRoute);
  const initialInventory = await inventoryDom(page);
  const result = await captureFrozenCasePhases({
    matrixCase,
    oracle: RUNTIME_MATRIX_ORACLE,
    controls: (evidence) =>
      controlsForCase(initialInventory, matrixCase, actionResultFor(evidence)),
    capturePhase: (phase) =>
      captureFrozenPhase({
        page,
        source,
        matrixCase,
        runtime,
        prepared,
        route: route.resolvedRoute,
        responseStatus: navigation.responseStatus,
        initialEvents: navigation.events,
        phase,
      }),
  });
  await persistFrozenCaseCell(runtime, result.cell);
  return result.cell;
};

const runFrozenCaseRange = async (
  page: Page,
  source: RuntimeMatrixSource,
  cases: readonly MatrixExecutableCase[],
  runtime: FrozenCaseLiveRuntime,
  testInfo: TestInfo,
  start: number,
  end: number,
): Promise<readonly FrozenCaseCoverageCell[]> => {
  if (start >= end) return [];
  if (end - start === 1) {
    const matrixCase = cases[start];
    if (matrixCase === undefined)
      throw new Error(`Frozen case range has no case at index ${start}`);
    return [await runFrozenCase(page, source, matrixCase, runtime, testInfo)];
  }
  const middle = start + Math.floor((end - start) / 2);
  const left = await runFrozenCaseRange(
    page,
    source,
    cases,
    runtime,
    testInfo,
    start,
    middle,
  );
  const right = await runFrozenCaseRange(
    page,
    source,
    cases,
    runtime,
    testInfo,
    middle,
    end,
  );
  return [...left, ...right];
};

export const runFrozenCases = (
  page: Page,
  source: RuntimeMatrixSource,
  cases: readonly MatrixExecutableCase[],
  runtime: FrozenCaseLiveRuntime,
  testInfo: TestInfo,
): Promise<readonly FrozenCaseCoverageCell[]> =>
  runFrozenCaseRange(page, source, cases, runtime, testInfo, 0, cases.length);
