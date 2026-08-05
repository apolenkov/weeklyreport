import type { Page } from "@playwright/test";

import { prisma } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import { type DOMControl, type MatrixExecution } from "./contracts.ts";
import { createE2eControlRecovery } from "./control-recovery.ts";
import { type DomInventory, inventoryDom } from "./dom-inventory.ts";
import { FAULT_DECLARATIONS } from "./fault-declarations.ts";
import { withFault } from "./fault-injection.ts";
import { sha256Hex } from "./ids.ts";
import {
  executeLiveControlPlans,
  type LiveControlActionRecord,
  type LiveControlPlan,
} from "./live-control-lane.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import { createPrismaRuntimeStateDatabase } from "./prisma-state-database.ts";
import {
  actorForPermission,
  routeForState,
  type RuntimeMatrixSource,
} from "./runtime-matrix.ts";
import { controlEvidence } from "./runtime-matrix-evidence.ts";
import type { RuntimeSurfaceExpectation } from "./runtime-surface-expectation.ts";
import {
  type PreparedRuntimeState,
  prepareRuntimeState,
  type StatePreparationRequest,
} from "./state-preparation.ts";

const ACTION_TARGET_WAIT_TIMEOUT_MS = 1000;

export interface FrozenCaseLiveRuntime {
  readonly archiveRoot: string;
  readonly baseURL: string;
  readonly databaseUrl: string;
  readonly repoRoot: string;
}

export type MatrixState = RuntimeMatrixSource["plan"]["states"][number];
export type ActionOutcome = Readonly<{
  readonly status: LiveControlActionRecord["status"];
  readonly controlKey: string;
  readonly observation?: LiveControlActionRecord["observation"];
  readonly reason?: string;
}>;

const executionAction = (execution: MatrixExecution) =>
  "action" in execution ? execution.action : undefined;

export const stateForCase = (matrixCase: MatrixExecutableCase): MatrixState => {
  const axes = {
    role: matrixCase.role,
    route: `${matrixCase.role}:${matrixCase.catalogRoute}`,
    ...matrixCase.state,
  };
  return {
    stateId: matrixCase.stateId,
    profile: matrixCase.profile,
    axes,
    pairwiseDigest: sha256Hex(axes),
  };
};

export const loginForCase = async (
  page: Page,
  matrixCase: MatrixExecutableCase,
): Promise<void> => {
  const actor = actorForPermission(
    matrixCase.state.permission,
    matrixCase.role,
  );
  if (actor.role === null) {
    await page.context().clearCookies();
    return;
  }
  await loginByCookie(page, {
    role: actor.role,
    expectRole: actor.role,
    ...(actor.email === null ? {} : { email: actor.email }),
  });
};

export const prepareCase = async (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
): Promise<
  Readonly<{ state: MatrixState; prepared: PreparedRuntimeState }>
> => {
  const state = stateForCase(matrixCase);
  const route = routeForState(source, state);
  const request: StatePreparationRequest = {
    profile: matrixCase.profile,
    axes: {
      lifecycle: matrixCase.state.lifecycle,
      submission: matrixCase.state.submission,
      ownership: matrixCase.state.ownershipDensity,
      permission: matrixCase.state.permission,
    },
    databaseUrl: runtime.databaseUrl,
    repoRoot: runtime.repoRoot,
    routeTarget: route.target,
    routeRole: route.role,
    routeKey: state.axes.route,
  };
  const prepared = await prepareRuntimeState(
    request,
    createPrismaRuntimeStateDatabase(prisma),
  );
  if (!prepared.observation.matches)
    throw new Error(
      `State oracle mismatch before ${matrixCase.caseId}: ${JSON.stringify(prepared.observation.mismatches)}`,
    );
  return { state, prepared };
};

const recoveryFor = (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
) =>
  createE2eControlRecovery({
    databaseUrl: runtime.databaseUrl,
    profile: matrixCase.profile,
    repoRoot: runtime.repoRoot,
    assertBaseline: async () => {
      await prepareCase(source, matrixCase, runtime);
      await loginForCase(page, matrixCase);
      const route = routeForState(source, stateForCase(matrixCase));
      await page.goto(route.resolvedRoute);
    },
  });

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

const outcomeFromRecord = (
  record: LiveControlActionRecord | undefined,
  controlKey: string,
  surface?: RuntimeSurfaceExpectation,
): ActionOutcome =>
  record === undefined
    ? {
        status: "not-exercised",
        controlKey,
        reason:
          surface?.productActions === "inapplicable"
            ? (surface.productActionsReason ??
              "Product actions are inapplicable for this surface")
            : "Frozen action has no matching live control",
      }
    : {
        status: record.status,
        controlKey,
        ...(record.observation === undefined
          ? {}
          : { observation: record.observation }),
        ...(record.reason === undefined ? {} : { reason: record.reason }),
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
  if (target === undefined)
    return outcomeFromRecord(undefined, action.controlKey, surface);
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
  return outcomeFromRecord(record, action.controlKey, surface);
};

export const controlsForCase = (
  inventory: DomInventory,
  matrixCase: MatrixExecutableCase,
  actionResult: DOMControl["actionResult"],
  surface?: RuntimeSurfaceExpectation,
): readonly DOMControl[] => {
  const controls = controlEvidence(inventory, matrixCase.caseId);
  const action = executionAction(matrixCase.execution);
  if (action === undefined || action.operation === "navigate") return controls;
  const target = targetForAction(inventory, action);
  if (target === undefined) {
    if (surface?.productActions !== "inapplicable") return controls;
    return [
      ...controls,
      {
        controlKey: action.controlKey,
        cellId: matrixCase.caseId,
        ariaRole: action.controlKey.split(":", 1)[0] ?? "control",
        accessibleName: action.controlKey,
        enabled: false,
        order: controls.length,
        actionResult: {
          kind: "not-exercised",
          policy: "inapplicable",
          reason:
            surface.productActionsReason ??
            "Product actions are inapplicable for this surface",
        },
      },
    ];
  }
  return controls.map((control) =>
    control.controlKey === target.controlKey
      ? { ...control, controlKey: action.controlKey, actionResult }
      : control,
  );
};

export const actionFor = executionAction;
