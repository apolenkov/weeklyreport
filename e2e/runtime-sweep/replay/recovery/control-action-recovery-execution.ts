import type { ControlActionAttempt } from "../control-actions/control-action-executor.ts";
import type {
  ControlActionAttemptOutcome,
  ControlActionExecution,
  ControlActionInput,
  ControlActionRecoveryOutcome,
} from "../control-actions/control-action-types.ts";
import type { ControlActionRecovery } from "./control-recovery.ts";
import { recoverControlAction } from "./control-recovery.ts";

const attemptStatus = (
  attempt: ControlActionAttempt,
): "pass" | "fail" | "ambiguous" =>
  typeof attempt === "string" ? attempt : attempt.status;

const attemptReason = (attempt: ControlActionAttempt): string | undefined =>
  typeof attempt === "string" ? undefined : attempt.reason;

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

const boundaryIssue = async (
  callback: (() => Promise<void>) | undefined,
): Promise<string | undefined> => {
  if (callback === undefined) return undefined;
  try {
    await callback();
    return undefined;
  } catch (error: unknown) {
    return error instanceof Error
      ? error.message
      : "Unknown recovery evidence boundary failure";
  }
};

const recoveryIssue = async (
  recovery: ControlActionRecovery,
): Promise<string | undefined> => {
  try {
    await recoverControlAction(recovery);
    return undefined;
  } catch (error: unknown) {
    return error instanceof Error
      ? error.message
      : "Control action recovery failed";
  }
};

const recoveryOutcome = (
  issue: string | undefined,
): ControlActionRecoveryOutcome =>
  issue === undefined ? { status: "pass" } : { status: "fail", reason: issue };

const actionOutcome = (
  attempt: ControlActionAttempt,
): ControlActionAttemptOutcome => {
  const reason = attemptReason(attempt);
  return {
    status: attemptStatus(attempt),
    ...(reason === undefined ? {} : { reason }),
  };
};

const recoveredExecution = (
  input: ControlActionInput,
  attempt: ControlActionAttempt,
  resetPerformed: boolean,
): ControlActionExecution => {
  const operation = attemptStatus(attempt);
  const reason = attemptReason(attempt);
  if (operation === "ambiguous")
    return {
      status: "ambiguous",
      controlKey: input.control.controlKey,
      operation: input.action.operation,
      resetPerformed,
      reason: reason ?? "The stateful action did not produce a bounded outcome",
    };
  return {
    status: operation,
    controlKey: input.control.controlKey,
    operation: input.action.operation,
    resetPerformed,
    ...(operation === "fail"
      ? { reason: reason ?? "The control action did not complete successfully" }
      : {}),
  };
};

const afterRecoveryBoundaryIssue = async (
  boundary: ControlActionInput["recoveryBoundary"],
  beforeIssue: string | undefined,
  resetIssue: string | undefined,
): Promise<string | undefined> => {
  if (boundary === undefined || beforeIssue !== undefined) return undefined;
  return boundaryIssue(() =>
    boundary.afterRecovery(recoveryOutcome(resetIssue)),
  );
};

export const executeControlRecovery = async (
  input: ControlActionInput,
  attempt: ControlActionAttempt,
  recovery: ControlActionRecovery,
): Promise<ControlActionExecution> => {
  const recoveryBoundary = input.recoveryBoundary;
  const beforeIssue = await boundaryIssue(
    recoveryBoundary === undefined
      ? undefined
      : () => recoveryBoundary.beforeRecovery(actionOutcome(attempt)),
  );
  const resetIssue = await recoveryIssue(recovery);
  const afterIssue = await afterRecoveryBoundaryIssue(
    recoveryBoundary,
    beforeIssue,
    resetIssue,
  );
  const evidenceIssue = beforeIssue ?? afterIssue;
  if (evidenceIssue !== undefined)
    return failed(input, `Recovery evidence boundary failed: ${evidenceIssue}`);
  if (recoveryBoundary === undefined && resetIssue !== undefined)
    return failed(input, resetIssue);
  return recoveredExecution(input, attempt, resetIssue === undefined);
};
