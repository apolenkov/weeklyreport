import {
  executeControlAttempt,
  targetLocator,
} from "./control-action-executor.ts";
import {
  requiresControlRecovery,
  validateControlActionPolicy,
} from "./control-action-policy.ts";
import type {
  ControlActionExecution,
  ControlActionInput,
} from "./control-action-types.ts";
import type { ControlActionRecovery } from "./control-recovery.ts";
import { recoverControlAction } from "./control-recovery.ts";

export {
  STATEFUL_CONTROL_OPERATIONS,
  type StatefulControlOperation,
} from "./control-action-policy.ts";
export type {
  ControlActionExecution,
  ControlActionInput,
  ControlActionObservation,
  ControlActionTarget,
} from "./control-action-types.ts";
export type {
  ControlActionRecovery,
  E2eControlRecoveryInput,
} from "./control-recovery.ts";
export {
  assertDisposableE2eDatabase,
  ControlActionPolicyError,
  ControlActionRecoveryError,
  createE2eControlRecovery,
} from "./control-recovery.ts";

const DEFAULT_ACTION_TIMEOUT_MS = 10_000;

const unsupported = (
  input: ControlActionInput,
  reason: string,
): ControlActionExecution => ({
  status: "not-exercised",
  controlKey: input.control.controlKey,
  operation: input.action.operation,
  resetPerformed: false,
  policy: "unavailable",
  reason,
});

const failed = (
  input: ControlActionInput,
  reason: string,
): ControlActionExecution => ({
  status: "fail",
  controlKey: input.control.controlKey,
  operation: input.action.operation,
  resetPerformed: false,
  reason,
});

const executionResultFor = (
  input: ControlActionInput,
  operation: "pass" | "fail",
): ControlActionExecution => ({
  status: operation,
  controlKey: input.control.controlKey,
  operation: input.action.operation,
  resetPerformed: false,
  ...(operation === "fail"
    ? { reason: "The control action did not complete successfully" }
    : {}),
});

const locateControl = async (
  input: ControlActionInput,
): Promise<ReturnType<typeof targetLocator> | ControlActionExecution> => {
  try {
    const locator = targetLocator(input.page, input.control);
    if ((await locator.count()) === 0)
      return unsupported(input, "Control is not present in the live DOM");
    if (!(await locator.isVisible()))
      return unsupported(input, "Control is not visible in the live DOM");
    if (!(await locator.isEnabled()))
      return unsupported(input, "Control is disabled");
    return locator;
  } catch (error: unknown) {
    return failed(
      input,
      error instanceof Error ? error.message : "Unable to locate control",
    );
  }
};

const isExecution = (
  value: ReturnType<typeof targetLocator> | ControlActionExecution,
): value is ControlActionExecution => "status" in value;

const recoveryResult = async (
  input: ControlActionInput,
  operation: Awaited<ReturnType<typeof executeControlAttempt>>,
  recovery: ControlActionRecovery,
): Promise<ControlActionExecution> => {
  try {
    await recoverControlAction(recovery);
  } catch (error: unknown) {
    return failed(
      input,
      error instanceof Error ? error.message : "Control action recovery failed",
    );
  }
  if (operation === "ambiguous")
    return {
      status: "ambiguous",
      controlKey: input.control.controlKey,
      operation: input.action.operation,
      resetPerformed: true,
      reason: "The stateful action did not produce a bounded outcome",
    };
  return {
    status: operation,
    controlKey: input.control.controlKey,
    operation: input.action.operation,
    resetPerformed: true,
    ...(operation === "fail"
      ? { reason: "The control action did not complete successfully" }
      : {}),
  };
};

export async function executeControlAction(
  input: ControlActionInput,
): Promise<ControlActionExecution> {
  const policyIssue = validateControlActionPolicy(input);
  if (policyIssue !== undefined) return policyIssue;
  const timeoutMs = input.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
  const located = await locateControl(input);
  if (isExecution(located)) return located;
  const operation = await executeControlAttempt(input, located, timeoutMs);
  if (!requiresControlRecovery(input)) {
    if (operation === "ambiguous")
      return failed(input, "A read-only control produced an ambiguous outcome");
    return executionResultFor(input, operation);
  }
  const recovery = input.recovery;
  if (recovery === undefined)
    return failed(input, "Stateful action recovery disappeared");
  return recoveryResult(input, operation, recovery);
}
