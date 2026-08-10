import type { Page } from "@playwright/test";

import { type ActionOperation } from "../source/contracts.ts";
import {
  requiresControlRecovery,
  STATEFUL_CONTROL_OPERATIONS,
  type StatefulControlOperation,
} from "./control-action-policy.ts";
import type {
  ControlActionInput,
  ControlActionObservation,
  ControlActionTarget,
  ResolvedActionControl,
} from "./control-action-types.ts";
import { confirmStatefulAction } from "./control-actions/confirmation.ts";
import { ControlActionPolicyError } from "./control-recovery.ts";
import {
  armRenderedNameHandle,
  beginRenderedNameAction,
  cleanupRenderedNameGuard,
  completeRenderedNameAction,
  type RenderedNameActionLease,
} from "./control-target/rendered-control-target.ts";

class ControlActionTimeoutError extends Error {
  override readonly name = "ControlActionTimeoutError";
}

export type ControlActionAttempt =
  | ControlActionObservation
  | "ambiguous"
  | Readonly<{
      readonly status: "fail" | "ambiguous";
      readonly reason: string;
    }>;

const isStateful = (
  operation: ActionOperation,
): operation is StatefulControlOperation =>
  (STATEFUL_CONTROL_OPERATIONS as readonly string[]).includes(operation);

const isSkipToContentLink = (control: ControlActionTarget): boolean =>
  control.ariaRole === "link" &&
  control.accessibleName.trim().toLocaleLowerCase() === "skip to content";

const documentWasDestroyed = (error: unknown): boolean =>
  error instanceof Error &&
  /(?:Execution context was destroyed|Cannot find context with specified id)/u.test(
    error.message,
  );

const cleanupRenderedTarget = async (
  resolved: Extract<ResolvedActionControl, { readonly kind: "handle" }>,
  lease: RenderedNameActionLease,
): Promise<void> => {
  try {
    await cleanupRenderedNameGuard(resolved.target, lease);
  } catch (error: unknown) {
    if (!documentWasDestroyed(error)) throw error;
  }
};

const representativeValueFor = (control: ControlActionTarget): string => {
  if (control.inputType === "email") return "runtime-sweep@example.invalid";
  if (control.inputType === "number") return "1";
  if (control.inputType === "date") return "2026-01-01";
  if (control.inputType === "url") return "https://example.invalid";
  return "Runtime sweep";
};

const fillOrSelect = async (
  resolved: ResolvedActionControl,
  input: ControlActionInput,
  timeoutMs: number,
): Promise<void> => {
  if (resolved.kind !== "locator")
    throw new ControlActionPolicyError(
      "Rendered-name fallback is not valid for form controls",
    );
  const locator = resolved.target;
  if (input.action.operation === "fill") {
    await locator.fill(input.value ?? representativeValueFor(input.control), {
      timeout: timeoutMs,
    });
    return;
  }
  if (input.action.operation !== "select") return;
  const alternative = locator
    .locator("option:not(:checked):not(:disabled)")
    .first();
  if ((await alternative.count()) === 0)
    throw new ControlActionPolicyError(
      "Native select has no enabled alternative option",
    );
  const index = await alternative.evaluate((option) => {
    if (!(option instanceof HTMLOptionElement))
      throw new TypeError("Native select alternative is not an option");
    return option.index;
  });
  await locator.selectOption({ index }, { timeout: timeoutMs });
};

const renderedActionCompleted = async (
  resolved: Extract<ResolvedActionControl, { readonly kind: "handle" }>,
  lease: RenderedNameActionLease,
): Promise<boolean> => {
  try {
    return await completeRenderedNameAction(resolved.target, lease);
  } catch (error: unknown) {
    if (documentWasDestroyed(error)) return true;
    throw error;
  }
};

const timeoutErrorFor = (timeoutMs: number): ControlActionTimeoutError =>
  new ControlActionTimeoutError(`Control action exceeded ${timeoutMs}ms`);

const remainingUntil = (deadline: number): number =>
  Math.max(1, deadline - Date.now());

const cleanupRenderedWithinDeadline = (
  resolved: Extract<ResolvedActionControl, { readonly kind: "handle" }>,
  lease: RenderedNameActionLease,
  timeoutMs: number,
): Promise<void> =>
  bounded(
    cleanupRenderedTarget(resolved, lease),
    remainingUntil(lease.deadline),
    timeoutMs,
  );

const performRenderedInput = (
  resolved: Extract<ResolvedActionControl, { readonly kind: "handle" }>,
  control: ControlActionTarget,
  signal: AbortSignal,
): Promise<void> =>
  isSkipToContentLink(control)
    ? resolved.target.press("Enter", { signal, timeout: 0 })
    : resolved.target.click({ signal, timeout: 0 });

const cleanupRenderedFailure = async (
  resolved: Extract<ResolvedActionControl, { readonly kind: "handle" }>,
  lease: RenderedNameActionLease,
  timeoutMs: number,
  signal: AbortSignal,
  error: unknown,
): Promise<never> => {
  if (signal.aborted || Date.now() >= lease.deadline)
    throw timeoutErrorFor(timeoutMs);
  await cleanupRenderedWithinDeadline(resolved, lease, timeoutMs);
  throw error;
};

const activateRenderedControl = async (
  resolved: Extract<ResolvedActionControl, { readonly kind: "handle" }>,
  control: ControlActionTarget,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const lease = await bounded(
    armRenderedNameHandle(resolved.target, deadline),
    timeoutMs,
  );
  if (lease === undefined)
    throw new ControlActionPolicyError("Rendered-name target changed");
  const remainingBeforeBegin = remainingUntil(lease.deadline);
  const began = await bounded(
    beginRenderedNameAction(resolved.target, lease),
    remainingBeforeBegin,
    timeoutMs,
  );
  if (!began) {
    await cleanupRenderedWithinDeadline(resolved, lease, timeoutMs);
    throw new ControlActionPolicyError("Rendered-name target changed");
  }
  const signal = AbortSignal.timeout(remainingUntil(lease.deadline));
  try {
    await bounded(
      performRenderedInput(resolved, control, signal),
      remainingUntil(lease.deadline),
      timeoutMs,
    );
    const completed = await bounded(
      renderedActionCompleted(resolved, lease),
      remainingUntil(lease.deadline),
      timeoutMs,
    );
    if (!completed)
      throw new ControlActionPolicyError(
        "Rendered-name action was invalidated",
      );
    await cleanupRenderedWithinDeadline(resolved, lease, timeoutMs);
  } catch (error: unknown) {
    return cleanupRenderedFailure(resolved, lease, timeoutMs, signal, error);
  }
};

const activateControl = async (
  page: Page,
  resolved: ResolvedActionControl,
  control: ControlActionTarget,
  timeoutMs: number,
): Promise<void> => {
  if (resolved.kind === "handle") {
    await activateRenderedControl(resolved, control, timeoutMs);
    return;
  }
  const { target } = resolved;
  if (!isSkipToContentLink(control)) {
    await target.click({ timeout: timeoutMs });
    return;
  }
  await target.focus({ timeout: timeoutMs });
  await page.keyboard.press("Enter");
};

const bounded = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  reportedTimeoutMs = timeoutMs,
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    const signal = AbortSignal.timeout(timeoutMs);
    signal.addEventListener(
      "abort",
      () => reject(timeoutErrorFor(reportedTimeoutMs)),
      { once: true },
    );
  });
  return Promise.race([operation, timeout]);
};

const failedAttemptFor = (
  action: ActionOperation,
  error: unknown,
): ControlActionAttempt => ({
  status: isStateful(action) ? "ambiguous" : "fail",
  reason: error instanceof Error ? error.message : "The control action failed",
});

export const executeControlAttempt = async (
  input: ControlActionInput,
  resolved: ResolvedActionControl,
  timeoutMs: number,
): Promise<ControlActionAttempt> => {
  const { action, page, observeOutcome } = input;
  try {
    if (action.operation === "fill" || action.operation === "select")
      await fillOrSelect(resolved, input, timeoutMs);
    else await activateControl(page, resolved, input.control, timeoutMs);
    if (isStateful(action.operation))
      await confirmStatefulAction(page, action.operation, timeoutMs);
    if (observeOutcome === undefined)
      return requiresControlRecovery(input) ? "ambiguous" : "pass";
    return await bounded(observeOutcome(), timeoutMs);
  } catch (error: unknown) {
    return failedAttemptFor(action.operation, error);
  }
};
