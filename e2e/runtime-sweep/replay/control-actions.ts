import {
  type ControlActionAttempt,
  executeControlAttempt,
} from "./control-action-executor.ts";
import {
  requiresControlRecovery,
  validateControlActionPolicy,
} from "./control-action-policy.ts";
import type {
  ControlActionExecution,
  ControlActionInput,
  ResolvedActionControl,
} from "./control-action-types.ts";
import type { ControlActionRecovery } from "./control-recovery.ts";
import { recoverControlAction } from "./control-recovery.ts";
import {
  hrefTargetLocator,
  releaseRenderedNameTarget,
  renderedNameTargetHandle,
  targetLocator,
  titleTargetLocator,
} from "./control-target/rendered-control-target.ts";

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
const TARGET_POLL_INTERVAL_MS = 25;

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

const visibleLocator = async (
  locators: readonly ReturnType<typeof targetLocator>[],
): Promise<ReturnType<typeof targetLocator> | undefined> => {
  for (const locator of locators)
    if ((await locator.count()) > 0 && (await locator.isVisible()))
      return locator;
  return undefined;
};

const allowsRenderedNameFallback = (input: ControlActionInput): boolean =>
  input.action.operation !== "fill" && input.action.operation !== "select";

const renderedControl = async (
  input: ControlActionInput,
  signal: AbortSignal,
): Promise<ResolvedActionControl | undefined> => {
  if (!allowsRenderedNameFallback(input)) return undefined;
  const target = await renderedNameTargetHandle(
    input.page,
    input.control,
    signal,
  );
  return target === undefined ? undefined : { kind: "handle", target };
};

const waitForCandidate = async (
  input: ControlActionInput,
  candidates: readonly ReturnType<typeof targetLocator>[],
  signal: AbortSignal,
): Promise<ResolvedActionControl | undefined> => {
  if (signal.aborted) return undefined;
  const semantic = await visibleLocator(candidates);
  if (semantic !== undefined) return { kind: "locator", target: semantic };
  const rendered = await renderedControl(input, signal);
  if (rendered !== undefined) return rendered;
  await input.page.waitForTimeout(TARGET_POLL_INTERVAL_MS);
  return waitForCandidate(input, candidates, signal);
};

const timeoutResult = (signal: AbortSignal): Promise<undefined> =>
  new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(undefined), { once: true });
  });

const candidateControl = async (
  input: ControlActionInput,
): Promise<ResolvedActionControl | undefined> => {
  const timeoutMs = Math.min(
    input.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS,
    TARGET_RESOLUTION_TIMEOUT_MS,
  );
  const primary = targetLocator(input.page, input.control);
  const titled = titleTargetLocator(input.page, input.control);
  const href = hrefTargetLocator(input.page, input.control);
  const candidates = [primary, titled, ...(href === undefined ? [] : [href])];
  const signal = AbortSignal.timeout(timeoutMs);
  return Promise.race([
    waitForCandidate(input, candidates, signal),
    timeoutResult(signal),
  ]);
};

const disposeResolvedHandle = async (
  resolved: ResolvedActionControl,
): Promise<void> => {
  if (resolved.kind === "handle") await resolved.target.dispose();
};

const releasePreArmHandle = async (
  resolved: ResolvedActionControl,
): Promise<void> => {
  if (resolved.kind !== "handle") return;
  await releaseRenderedNameTarget(resolved.target);
};

const enabledControl = async (
  input: ControlActionInput,
  resolved: ResolvedActionControl,
): Promise<ResolvedActionControl | ControlActionExecution> => {
  const isEnabled = await resolved.target
    .isEnabled()
    .catch(async (error: unknown) => {
      await releasePreArmHandle(resolved);
      throw error;
    });
  if (isEnabled) return resolved;
  await releasePreArmHandle(resolved);
  return unsupported(input, "Control is disabled");
};

const locateControl = async (
  input: ControlActionInput,
): Promise<ResolvedActionControl | ControlActionExecution> => {
  try {
    const resolved = await candidateControl(input);
    if (resolved === undefined)
      return unsupported(input, "Control is not present in the live DOM");
    return await enabledControl(input, resolved);
  } catch (error: unknown) {
    return failed(
      input,
      error instanceof Error ? error.message : "Unable to locate control",
    );
  }
};

const isExecution = (
  value: ResolvedActionControl | ControlActionExecution,
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
  const attempt = await (async (): Promise<ControlActionAttempt> => {
    try {
      return await executeControlAttempt(input, located, timeoutMs);
    } finally {
      await disposeResolvedHandle(located);
    }
  })();
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
