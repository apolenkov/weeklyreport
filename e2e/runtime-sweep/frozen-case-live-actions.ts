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
import {
  type PreparedRuntimeState,
  prepareRuntimeState,
  type StatePreparationRequest,
} from "./state-preparation.ts";

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

const outcomeFromRecord = (
  record: LiveControlActionRecord | undefined,
  controlKey: string,
): ActionOutcome =>
  record === undefined
    ? {
        status: "not-exercised",
        controlKey,
        reason: "Frozen action has no matching live control",
      }
    : {
        status: record.status,
        controlKey,
        ...(record.reason === undefined ? {} : { reason: record.reason }),
      };

export const runAction = async (
  page: Page,
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
): Promise<ActionOutcome | undefined> => {
  const action = executionAction(matrixCase.execution);
  if (action === undefined || action.operation === "navigate") return undefined;
  const target = targetForAction(await inventoryDom(page), action);
  if (target === undefined)
    return outcomeFromRecord(undefined, action.controlKey);
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
  return outcomeFromRecord(record, action.controlKey);
};

export const controlsForCase = (
  inventory: DomInventory,
  matrixCase: MatrixExecutableCase,
  actionResult: DOMControl["actionResult"],
): readonly DOMControl[] => {
  const controls = controlEvidence(inventory, matrixCase.caseId);
  const action = executionAction(matrixCase.execution);
  if (action === undefined || action.operation === "navigate") return controls;
  const target = targetForAction(inventory, action);
  if (target === undefined) return controls;
  return controls.map((control) =>
    control.controlKey === target.controlKey
      ? { ...control, controlKey: action.controlKey, actionResult }
      : control,
  );
};

export const actionFor = executionAction;
