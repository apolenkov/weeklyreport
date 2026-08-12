import type { Page, TestInfo } from "@playwright/test";

import type { MatrixExecutableCase } from "../../../matrix/matrix-finalizer.ts";
import {
  routeForState,
  RUNTIME_MATRIX_ORACLE,
  type RuntimeMatrixSource,
} from "../../../matrix/runtime-matrix.ts";
import { writeCell } from "../../../matrix/runtime-matrix-evidence.ts";
import { runSpecializedCase } from "../../../matrix/specialized/specialized-case-runner.ts";
import { assertResolverOutcomeExpectation } from "../../../support/resolver-outcome-expectations.ts";
import { inventoryDom } from "../../dom/dom-inventory.ts";
import type { FrozenCaseCoverageCell } from "../../evidence/frozen-case-evidence.ts";
import { captureAndFinalizeFrozenCase } from "../../evidence/frozen-case-live-evidence.ts";
import {
  replayFrozenRevealPath,
  resolveFrozenRevealPreparation,
} from "../../frozen-reveal/frozen-reveal-replay.ts";
import { executeFrozenRevealControl } from "../../frozen-reveal/frozen-reveal-replay-adapter.ts";
import { settleNavigation } from "../../navigation.ts";
import {
  type FrozenCaseLiveRuntime,
  loginForCase,
  prepareCase,
  stateForCase,
} from "./frozen-case-live-actions.ts";
import { initialNavigation } from "./frozen-case-live-capture.ts";
import {
  quiesceFrozenCasePage,
  runFrozenCaseCampaign,
  type RuntimeFrozenCaseExecutor,
} from "./frozen-case-live-group-runner.ts";

export type { FrozenCaseLiveRuntime } from "./frozen-case-live-actions.ts";

const persistFrozenCaseCell = async (
  runtime: FrozenCaseLiveRuntime,
  cell: FrozenCaseCoverageCell,
): Promise<void> => {
  await writeCell(runtime.archiveRoot, cell);
};

const requirePassingPersistedCell = (
  cell: FrozenCaseCoverageCell,
): FrozenCaseCoverageCell => {
  if (cell.verdict !== "pass")
    throw new Error(
      `Frozen case ${cell.cellId} stopped the lane with verdict=${cell.verdict}`,
    );
  return cell;
};

const reuseProfileBaseline = (): void => undefined;

const replayFrozenPreparation = async (input: {
  readonly page: Page;
  readonly source: RuntimeMatrixSource;
  readonly matrixCase: MatrixExecutableCase;
  readonly runtime: FrozenCaseLiveRuntime;
  readonly prepared: Awaited<ReturnType<typeof prepareCase>>["prepared"];
  readonly navigation: Awaited<ReturnType<typeof initialNavigation>>;
}): Promise<void> => {
  try {
    const preparation = resolveFrozenRevealPreparation(
      input.source,
      input.matrixCase,
    );
    if (preparation === undefined) return;
    const [dbModule, preflightModule, proofModule, drainModule] =
      await Promise.all([
        import("../../../../integration/helpers/db.ts"),
        import("../../../preflight/runtime/prisma-state-database.ts"),
        import("../../../support/state-preparation-nonmutation.ts"),
        import("../../../support/runtime-api-drain.ts"),
      ]);
    const database = preflightModule.createPrismaRuntimeStateDatabase(
      dbModule.prisma,
    );
    await replayFrozenRevealPath({
      page: input.page,
      preparation,
      inventory: inventoryDom,
      execute: executeFrozenRevealControl,
      settle: () => settleNavigation(input.page),
      proveNonMutation: (action) =>
        proofModule.provePreparedStateNonMutation({
          database,
          prepared: input.prepared,
          settle: () => drainModule.awaitRuntimeApiDrain(input.runtime.apiURL),
          action,
        }),
      cleanup: () => undefined,
    });
  } catch (error: unknown) {
    input.navigation.events.collector.detach();
    throw error;
  }
};

const runFrozenCase: RuntimeFrozenCaseExecutor = async (
  page,
  source,
  matrixCase,
  runtime,
  testInfo,
  preparedCase,
) => {
  const browser = page.context().browser();
  if (browser === null)
    throw new Error(`Frozen case ${matrixCase.caseId} has no browser context`);
  const specialized = await runSpecializedCase({
    page,
    browser,
    baseURL: runtime.baseURL,
    repoRoot: runtime.repoRoot,
    archiveRoot: runtime.archiveRoot,
    bugsinkDsn: runtime.bugsinkDsn,
    matrixCase,
    oracle: RUNTIME_MATRIX_ORACLE,
    testInfo,
    capturedAt: new Date().toISOString(),
    databaseUrl: runtime.databaseUrl,
  });
  if (specialized !== undefined) {
    await persistFrozenCaseCell(runtime, specialized.cell);
    return requirePassingPersistedCell(specialized.cell);
  }
  if (preparedCase === undefined) await quiesceFrozenCasePage(page, runtime);
  const prepared =
    preparedCase ??
    (await prepareCase(source, matrixCase, runtime, reuseProfileBaseline))
      .prepared;
  await loginForCase(page, matrixCase, runtime.baseURL);
  const route = routeForState(source, stateForCase(matrixCase));
  assertResolverOutcomeExpectation(
    route.expectedOutcome,
    matrixCase.expectedOutcome,
  );
  const navigation = await initialNavigation(
    page,
    route.resolvedRoute,
    route.landingRoute,
    runtime.baseURL,
    route.expectedOutcome,
  );
  await replayFrozenPreparation({
    page,
    source,
    matrixCase,
    runtime,
    prepared,
    navigation,
  });
  const cell = await captureAndFinalizeFrozenCase(
    page,
    source,
    matrixCase,
    runtime,
    prepared,
    route,
    navigation,
  );
  await persistFrozenCaseCell(runtime, cell);
  return requirePassingPersistedCell(cell);
};

export const runFrozenCases = async (
  page: Page,
  source: RuntimeMatrixSource,
  cases: readonly MatrixExecutableCase[],
  runtime: FrozenCaseLiveRuntime,
  testInfo: TestInfo,
): Promise<readonly FrozenCaseCoverageCell[]> =>
  runFrozenCaseCampaign({
    page,
    source,
    cases,
    runtime,
    testInfo,
    execute: runFrozenCase,
  });
