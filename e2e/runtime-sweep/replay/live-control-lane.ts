import type { Page } from "@playwright/test";

import type {
  ControlActionRecovery,
  ControlActionRecoveryBoundary,
} from "./control-actions.ts";
import { executeControlAction } from "./control-actions.ts";
import type { DomControlObservation } from "./dom-inventory.ts";
import { type PageSnapshot, snapshotPage } from "./live-control-observation.ts";
import {
  type LiveControlActionRecord,
  type LiveControlPlan,
  type LiveControlPlanningOptions,
  planLiveControlActions,
} from "./live-control-planning.ts";
import {
  actionFailureRecord,
  notExercisedRecord,
  observationAfter,
  observerFor,
  planSignature,
  recordFor,
  targetFor,
} from "./live-control-records.ts";
import { createRecoveryObservationBoundary } from "./recovery/live-control-recovery-observation.ts";

export type {
  LiveControlActionRecord,
  LiveControlObservation,
  LiveControlPlan,
  LiveControlPlanningOptions,
} from "./live-control-planning.ts";
export { planLiveControlActions } from "./live-control-planning.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ACTIONS = 256;

export interface LiveControlExecutionInput {
  readonly page: Page;
  readonly plans: readonly LiveControlPlan[];
  readonly recovery?: ControlActionRecovery;
  readonly recoveryBoundary?: ControlActionRecoveryBoundary;
  readonly preparePage: () => Promise<void>;
  readonly reinventory?: () => Promise<readonly DomControlObservation[]>;
  readonly planningOptions?: LiveControlPlanningOptions;
  readonly timeoutMs?: number;
  readonly maxActions?: number;
}

interface PendingPlan {
  readonly plan: LiveControlPlan;
  readonly prepare: boolean;
}

const recoveryOptionsFor = (
  input: LiveControlExecutionInput,
  boundary = input.recoveryBoundary,
): Pick<LiveControlExecutionInput, "recovery" | "recoveryBoundary"> => ({
  ...(input.recovery === undefined ? {} : { recovery: input.recovery }),
  ...(boundary === undefined ? {} : { recoveryBoundary: boundary }),
});

type ObservationOptions = Parameters<typeof observationAfter>[4];
type RecoveryObservation = ReturnType<typeof createRecoveryObservationBoundary>;

const recoveryObservationFor = (
  input: LiveControlExecutionInput,
  operation: string,
  before: PageSnapshot,
  options: ObservationOptions,
): RecoveryObservation | undefined =>
  input.recoveryBoundary === undefined
    ? undefined
    : createRecoveryObservationBoundary(input.recoveryBoundary, (outcome) =>
        observationAfter(
          input.page,
          operation,
          before,
          outcome.status,
          options,
        ),
      );

const finalObservation = async (
  input: LiveControlExecutionInput,
  operation: string,
  before: PageSnapshot,
  status: Parameters<typeof observationAfter>[3],
  options: ObservationOptions,
  recovery: RecoveryObservation | undefined,
) => {
  recovery?.finalize();
  const result = await recovery?.result;
  return result?.captured === true
    ? result.observation
    : observationAfter(input.page, operation, before, status, options);
};

const executePlan = async (
  input: LiveControlExecutionInput,
  plan: LiveControlPlan,
): Promise<LiveControlActionRecord> => {
  if (plan.action === undefined) return notExercisedRecord(plan);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const before: PageSnapshot = await snapshotPage(input.page);
  const operation = plan.action.operation;
  const control = targetFor(plan.control);
  const observationOptions = {
    control,
    allowIdempotent:
      plan.action.operation === "click" && plan.action.safety === "read-only",
    requireMeaningfulFocus:
      plan.control.role === "link" &&
      plan.control.accessibleName.toLocaleLowerCase() === "skip to content",
  } as const;
  const observeOutcome = observerFor(
    input.page,
    operation,
    before,
    timeoutMs,
    observationOptions,
  );
  const recoveryObservation = recoveryObservationFor(
    input,
    operation,
    before,
    observationOptions,
  );
  try {
    const execution = await executeControlAction({
      page: input.page,
      control,
      action: plan.action,
      ...recoveryOptionsFor(input, recoveryObservation?.boundary),
      observeOutcome,
      ...(operation === "fill" ? { value: "Runtime sweep" } : {}),
      timeoutMs,
    });
    const observation = await finalObservation(
      input,
      operation,
      before,
      execution.status,
      observationOptions,
      recoveryObservation,
    );
    if (execution.status === "pass" && observation === undefined)
      return actionFailureRecord(
        plan,
        "The control action produced no observable outcome",
      );
    return recordFor(plan, execution, observation);
  } catch (error: unknown) {
    return actionFailureRecord(
      plan,
      error instanceof Error ? error.message : "Unknown control action failure",
    );
  }
};

const dynamicPlans = (
  controls: readonly DomControlObservation[],
  known: ReadonlyMap<string, string>,
  options: LiveControlPlanningOptions | undefined,
): readonly PendingPlan[] =>
  planLiveControlActions(controls, options).flatMap((plan) => {
    const signature = planSignature(plan);
    if (known.get(plan.control.controlKey) === signature) return [];
    return [{ plan, prepare: false }];
  });

const runPreparedPlan = async (
  input: LiveControlExecutionInput,
  pending: PendingPlan,
): Promise<LiveControlActionRecord> => {
  if (!pending.prepare) return executePlan(input, pending.plan);
  try {
    await input.preparePage();
    return await executePlan(input, pending.plan);
  } catch (error: unknown) {
    return actionFailureRecord(
      pending.plan,
      error instanceof Error ? error.message : "Unable to prepare route",
    );
  }
};

type Reinventoried =
  | Readonly<{ controls: readonly DomControlObservation[] }>
  | Readonly<{ error: string }>;

const reinventory = async (
  input: LiveControlExecutionInput,
): Promise<Reinventoried> => {
  if (input.reinventory === undefined) return { controls: [] };
  try {
    return { controls: await input.reinventory() };
  } catch (error: unknown) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to re-inventory controls",
    };
  }
};

const drainPlans = async (
  input: LiveControlExecutionInput,
  queue: readonly PendingPlan[],
  known: Map<string, string>,
  records: readonly LiveControlActionRecord[],
  completed = 0,
): Promise<readonly LiveControlActionRecord[]> => {
  const [next, ...remaining] = queue;
  if (next === undefined) return records;
  const maxActions = input.maxActions ?? DEFAULT_MAX_ACTIONS;
  if (completed >= maxActions)
    return [
      ...records,
      ...queue.map((pending) =>
        notExercisedRecord(
          pending.plan,
          `Live control action limit ${maxActions} exceeded`,
        ),
      ),
    ];
  const record = await runPreparedPlan(input, next);
  if (input.reinventory === undefined)
    return drainPlans(
      input,
      remaining,
      known,
      [...records, record],
      completed + 1,
    );
  const inventory = await reinventory(input);
  if ("error" in inventory) {
    return drainPlans(
      input,
      remaining,
      known,
      [...records, actionFailureRecord(next.plan, inventory.error)],
      completed + 1,
    );
  }
  const controls = inventory.controls;
  const newlyReachable = dynamicPlans(controls, known, input.planningOptions);
  newlyReachable.forEach(({ plan }) => {
    known.set(plan.control.controlKey, planSignature(plan));
  });
  return drainPlans(
    input,
    [...newlyReachable, ...remaining],
    known,
    [...records, record],
    completed + 1,
  );
};

export function executeLiveControlPlans(
  input: LiveControlExecutionInput,
): Promise<readonly LiveControlActionRecord[]> {
  const initial = input.plans.map((plan) => ({ plan, prepare: true }));
  const known = new Map(
    input.plans.map((plan) => [plan.control.controlKey, planSignature(plan)]),
  );
  return drainPlans(input, initial, known, []);
}
