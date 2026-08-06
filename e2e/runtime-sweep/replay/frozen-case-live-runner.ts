import type { Page, TestInfo } from "@playwright/test";

import type { EvidencePhase } from "../evidence/evidence-types.ts";
import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import {
  routeForState,
  RUNTIME_MATRIX_ORACLE,
  type RuntimeMatrixSource,
} from "../matrix/runtime-matrix.ts";
import { writeCell } from "../matrix/runtime-matrix-evidence.ts";
import { runSpecializedCase } from "../matrix/specialized-case-runner.ts";
import type { DOMControl } from "../source/contracts.ts";
import type { PreparedRuntimeState } from "../support/state-preparation.ts";
import type { DomInventory } from "./dom-inventory.ts";
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

export type { FrozenCaseLiveRuntime } from "./frozen-case-live-actions.ts";

const persistFrozenCaseCell = async (
  runtime: FrozenCaseLiveRuntime,
  cell: FrozenCaseCoverageCell,
): Promise<void> => {
  await writeCell(runtime.archiveRoot, cell);
};

const reuseProfileBaseline = (): void => undefined;

const captureFrozenCase = async (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  prepared: PreparedRuntimeState,
  route: string,
  navigation: Awaited<ReturnType<typeof initialNavigation>>,
): Promise<FrozenCaseCoverageCell> => {
  const phaseInventories = new Map<EvidencePhase, DomInventory>();
  const actionTargets = new Map<
    EvidencePhase,
    DomInventory["controls"][number]
  >();
  const result = await captureFrozenCasePhases({
    matrixCase,
    oracle: RUNTIME_MATRIX_ORACLE,
    surface: prepared.plan.surface,
    controls: (evidence) => {
      const actionInventory = phaseInventories.get("action");
      if (actionInventory === undefined)
        throw new Error(
          `Frozen case ${matrixCase.caseId} has no action-phase inventory`,
        );
      return controlsForCase(
        actionInventory,
        matrixCase,
        actionResultFor(evidence),
        prepared.plan.surface,
        actionTargets.get("action"),
      );
    },
    capturePhase: async (phase) => {
      const evidence = await captureFrozenPhase({
        page,
        source,
        matrixCase,
        runtime,
        prepared,
        route,
        responseStatus: navigation.responseStatus,
        initialEvents: navigation.events,
        phase,
        onInventory: (inventory) => phaseInventories.set(phase, inventory),
        onActionTarget: (target) => actionTargets.set("action", target),
      });
      return evidence;
    },
  });
  return result.cell;
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
  const { prepared } = await prepareCase(
    source,
    matrixCase,
    runtime,
    reuseProfileBaseline,
  );
  await loginForCase(page, matrixCase, runtime.baseURL);
  const route = routeForState(source, stateForCase(matrixCase));
  const navigation = await initialNavigation(page, route.resolvedRoute);
  const cell = await captureFrozenCase(
    page,
    source,
    matrixCase,
    runtime,
    prepared,
    route.resolvedRoute,
    navigation,
  );
  await persistFrozenCaseCell(runtime, cell);
  return cell;
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
