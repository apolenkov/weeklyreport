import type { Page } from "@playwright/test";

import type { MatrixExecutableCase } from "../matrix/matrix-finalizer.ts";
import {
  routeForState,
  type RuntimeMatrixSource,
} from "../matrix/runtime-matrix.ts";
import { controlEvidence } from "../matrix/runtime-matrix-evidence.ts";
import {
  observeRuntimeSurface,
  type RuntimeSurfaceExpectation,
  type RuntimeSurfaceObservation,
} from "../preflight/runtime-surface-expectation.ts";
import { FAULT_DECLARATIONS } from "../scenarios/faults/fault-declarations.ts";
import { withFault } from "../scenarios/faults/fault-injection.ts";
import { type DOMControl, type MatrixExecution } from "../source/contracts.ts";
import { createE2eControlRecovery } from "./control-recovery.ts";
import { type DomInventory, inventoryDom } from "./dom-inventory.ts";
import {
  type FrozenCaseLiveRuntime,
  loginForCase,
  prepareCase,
  stateForCase,
} from "./frozen-case-live-preparation.ts";
import {
  executeLiveControlPlans,
  type LiveControlActionRecord,
  type LiveControlPlan,
} from "./live-control-lane.ts";

const ACTION_TARGET_WAIT_TIMEOUT_MS = 1000;

export type ActionOutcome = Readonly<{
  readonly status: LiveControlActionRecord["status"];
  readonly controlKey: string;
  // Keep the pre-action identity when the action removes or renames the target.
  readonly target?: DomInventory["controls"][number];
  readonly observation?: LiveControlActionRecord["observation"];
  readonly surfaceObservation?: RuntimeSurfaceObservation;
  readonly reason?: string;
}>;

const executionAction = (execution: MatrixExecution) =>
  "action" in execution ? execution.action : undefined;

const recoveryFor = (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
) => {
  const recovery = createE2eControlRecovery({
    databaseUrl: runtime.databaseUrl,
    profile: matrixCase.profile,
    repoRoot: runtime.repoRoot,
    assertBaseline: async () => {
      await prepareCase(source, matrixCase, runtime, () => Promise.resolve());
      await loginForCase(page, matrixCase, runtime.baseURL);
      const route = routeForState(source, stateForCase(matrixCase));
      await page.goto(route.resolvedRoute);
    },
  });
  return {
    ...recovery,
    resetAndReseed: async (): Promise<void> => {
      await page.goto("about:blank");
      await recovery.resetAndReseed();
    },
  };
};

const targetForAction = (
  inventory: DomInventory,
  action: NonNullable<ReturnType<typeof executionAction>>,
) =>
  inventory.controls.find(({ controlKey }) => controlKey === action.controlKey);

const waitForActionTargetUntil = async (
  page: Page,
  action: NonNullable<ReturnType<typeof executionAction>>,
  deadline: number,
): Promise<ReturnType<typeof targetForAction>> => {
  const target = targetForAction(await inventoryDom(page), action);
  if (target !== undefined || Date.now() >= deadline) return target;
  try {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        }),
    );
  } catch (error: unknown) {
    if (!(
      error instanceof Error &&
      /Execution context was destroyed.*navigation/iu.test(error.message)
    ))
      throw error;
  }
  return waitForActionTargetUntil(page, action, deadline);
};

const waitForActionTarget = async (
  page: Page,
  action: NonNullable<ReturnType<typeof executionAction>>,
): Promise<ReturnType<typeof targetForAction>> =>
  waitForActionTargetUntil(
    page,
    action,
    Date.now() + ACTION_TARGET_WAIT_TIMEOUT_MS,
  );

const missingActionReason = (
  surface: RuntimeSurfaceExpectation | undefined,
  surfaceObservation: RuntimeSurfaceObservation | undefined,
): string => {
  if (surface?.productActions !== "inapplicable")
    return "Frozen action has no matching live control";
  if (surfaceObservation?.marker.present === true)
    return (
      surface.productActionsReason ??
      "Product actions are inapplicable for this surface"
    );
  return "Frozen action has no matching live control and the expected unavailable surface marker was not observed";
};

const outcomeWithoutRecord = (
  controlKey: string,
  surface: RuntimeSurfaceExpectation | undefined,
  surfaceObservation: RuntimeSurfaceObservation | undefined,
): ActionOutcome => ({
  status: "not-exercised",
  controlKey,
  ...(surfaceObservation === undefined ? {} : { surfaceObservation }),
  reason: missingActionReason(surface, surfaceObservation),
});

const outcomeFromRecord = (
  record: LiveControlActionRecord | undefined,
  controlKey: string,
  surface?: RuntimeSurfaceExpectation,
  surfaceObservation?: RuntimeSurfaceObservation,
  target?: DomInventory["controls"][number],
): ActionOutcome => {
  if (record === undefined)
    return outcomeWithoutRecord(controlKey, surface, surfaceObservation);
  return {
    status: record.status,
    controlKey,
    ...(target === undefined ? {} : { target }),
    ...(record.observation === undefined
      ? {}
      : { observation: record.observation }),
    ...(surfaceObservation === undefined ? {} : { surfaceObservation }),
    ...(record.reason === undefined ? {} : { reason: record.reason }),
  };
};

export const runAction = async (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  surface?: RuntimeSurfaceExpectation,
): Promise<ActionOutcome | undefined> => {
  const action = executionAction(matrixCase.execution);
  if (action === undefined || action.operation === "navigate") return undefined;
  const target = await waitForActionTarget(page, action);
  if (target === undefined) {
    const surfaceObservation =
      surface?.productActions === "inapplicable"
        ? await observeRuntimeSurface(page)
        : undefined;
    return outcomeFromRecord(
      undefined,
      action.controlKey,
      surface,
      surfaceObservation,
    );
  }
  const plan: LiveControlPlan = { control: target, action };
  const execute = async (): Promise<LiveControlActionRecord | undefined> =>
    (
      await executeLiveControlPlans({
        page,
        plans: [plan],
        recovery: recoveryFor(page, source, matrixCase, runtime),
        preparePage: () => Promise.resolve(),
        planningOptions: { formSafety: "disposable-reset" },
      })
    )[0];
  const faultId =
    "faultId" in matrixCase.execution
      ? matrixCase.execution.faultId
      : undefined;
  const declaration = FAULT_DECLARATIONS.find(({ id }) => id === faultId);
  const record =
    declaration === undefined
      ? await execute()
      : await withFault(page, declaration, execute);
  return outcomeFromRecord(
    record,
    action.controlKey,
    surface,
    undefined,
    target,
  );
};

type FrozenActionTarget = DomInventory["controls"][number];

const actionControlFor = (
  control: FrozenActionTarget,
  actionResult: DOMControl["actionResult"],
  matrixCase: MatrixExecutableCase,
): DOMControl => {
  const [actionControl] = controlEvidence(
    { controls: [control], issues: [] },
    matrixCase.caseId,
  );
  if (actionControl === undefined)
    throw new Error(`Unable to freeze action target ${control.controlKey}`);
  return { ...actionControl, actionResult };
};

const orderControls = (
  controls: readonly DOMControl[],
): readonly DOMControl[] =>
  controls.toSorted(
    (left, right) =>
      left.order - right.order ||
      left.controlKey.localeCompare(right.controlKey),
  );

export const controlsForCase = (
  inventory: DomInventory,
  matrixCase: MatrixExecutableCase,
  actionResult: DOMControl["actionResult"],
  _surface?: RuntimeSurfaceExpectation,
  frozenTarget?: FrozenActionTarget,
): readonly DOMControl[] => {
  const controls = controlEvidence(inventory, matrixCase.caseId);
  const action = executionAction(matrixCase.execution);
  if (action === undefined || action.operation === "navigate") return controls;
  const target = targetForAction(inventory, action);
  if (target === undefined) {
    return actionResult.kind === "exercised" &&
      actionResult.result === "pass" &&
      frozenTarget !== undefined
      ? orderControls([
          ...controls,
          actionControlFor(frozenTarget, actionResult, matrixCase),
        ])
      : controls;
  }
  return controls.map((control) =>
    control.controlKey === target.controlKey
      ? { ...control, controlKey: action.controlKey, actionResult }
      : control,
  );
};

export const actionFor = executionAction;
