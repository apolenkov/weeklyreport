import {
  type ControlActionAttempt,
  executeControlAttempt,
  hrefTargetLocator,
  targetLocator,
  titleTargetLocator,
  waitForVisible,
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
const TARGET_RESOLUTION_TIMEOUT_MS = 5000;

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
  reason?: string,
): ControlActionExecution => ({
  status: operation,
  controlKey: input.control.controlKey,
  operation: input.action.operation,
  resetPerformed: false,
  ...(operation === "fail"
    ? { reason: reason ?? "The control action did not complete successfully" }
    : {}),
});

const attemptStatus = (
  attempt: ControlActionAttempt,
): "pass" | "fail" | "ambiguous" =>
  typeof attempt === "string" ? attempt : attempt.status;

const attemptReason = (attempt: ControlActionAttempt): string | undefined =>
  typeof attempt === "string" ? undefined : attempt.reason;

const candidateLocator = async (
  input: ControlActionInput,
): Promise<ReturnType<typeof targetLocator> | undefined> => {
  const timeoutMs = Math.min(
    input.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS,
    TARGET_RESOLUTION_TIMEOUT_MS,
  );
  const primary = targetLocator(input.page, input.control);
  const titled = titleTargetLocator(input.page, input.control);
  const href = hrefTargetLocator(input.page, input.control);
  const candidates =
    href === undefined ? [primary, titled] : [primary, titled, href];
  const resolveVisible = async (
    remaining: readonly (typeof primary)[],
  ): Promise<typeof primary | undefined> => {
    const [candidate, ...rest] = remaining;
    if (candidate === undefined) return undefined;
    if (
      (await candidate.count()) > 0 &&
      (await waitForVisible(candidate, timeoutMs))
    )
      return candidate;
    return resolveVisible(rest);
  };
  const visible = await resolveVisible(candidates);
  if (visible !== undefined) return visible;
  const delayedVisibility = await Promise.all(
    candidates.map((candidate) => waitForVisible(candidate, timeoutMs)),
  );
  const delayedIndex = delayedVisibility.findIndex(Boolean);
  return delayedIndex === -1 ? undefined : candidates[delayedIndex];
};

const locateControl = async (
  input: ControlActionInput,
): Promise<ReturnType<typeof targetLocator> | ControlActionExecution> => {
  try {
    const locator = await candidateLocator(input);
    if (locator === undefined)
      return unsupported(input, "Control is not present in the live DOM");
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
  attempt: ControlActionAttempt,
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
  const operation = attemptStatus(attempt);
  const reason = attemptReason(attempt);
  if (operation === "ambiguous")
    return {
      status: "ambiguous",
      controlKey: input.control.controlKey,
      operation: input.action.operation,
      resetPerformed: true,
      reason: reason ?? "The stateful action did not produce a bounded outcome",
    };
  return {
    status: operation,
    controlKey: input.control.controlKey,
    operation: input.action.operation,
    resetPerformed: true,
    ...(operation === "fail"
      ? { reason: reason ?? "The control action did not complete successfully" }
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
  const attempt = await executeControlAttempt(input, located, timeoutMs);
  const operation = attemptStatus(attempt);
  const reason = attemptReason(attempt);
  if (!requiresControlRecovery(input)) {
    if (operation === "ambiguous")
      return failed(
        input,
        reason ?? "A read-only control produced an ambiguous outcome",
      );
    return executionResultFor(input, operation, reason);
  }
  const recovery = input.recovery;
  if (recovery === undefined)
    return failed(input, "Stateful action recovery disappeared");
  return recoveryResult(input, attempt, recovery);
}
