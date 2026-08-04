import type { Locator, Page } from "@playwright/test";

import { type ActionOperation } from "./contracts.ts";
import {
  requiresControlRecovery,
  STATEFUL_CONTROL_OPERATIONS,
  type StatefulControlOperation,
} from "./control-action-policy.ts";
import {
  SUPPORTED_CONTROL_ROLES,
  type SupportedControlRole,
} from "./control-action-roles.ts";
import type {
  ControlActionInput,
  ControlActionObservation,
  ControlActionTarget,
} from "./control-action-types.ts";
import { ControlActionPolicyError } from "./control-recovery.ts";

const DEFAULT_OCCURRENCE = 1;
const CONFIRMATION_NAMES: Readonly<Record<StatefulControlOperation, RegExp>> = {
  publish: /publish/i,
  delete: /delete/i,
  revoke: /revoke/i,
  restore: /restore|unarchive/i,
};

class ControlActionTimeoutError extends Error {
  override readonly name = "ControlActionTimeoutError";
}

const isStateful = (
  operation: ActionOperation,
): operation is StatefulControlOperation =>
  (STATEFUL_CONTROL_OPERATIONS as readonly string[]).includes(operation);

const isSupportedRole = (role: string): role is SupportedControlRole =>
  (SUPPORTED_CONTROL_ROLES as readonly string[]).includes(role);

const occurrenceFrom = (controlKey: string): number => {
  const match = /:(\d+)$/u.exec(controlKey);
  const value = Number(match?.[1] ?? DEFAULT_OCCURRENCE);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_OCCURRENCE;
};

export const targetLocator = (
  page: Page,
  control: ControlActionTarget,
): Locator => {
  if (!isSupportedRole(control.ariaRole))
    throw new ControlActionPolicyError(`Unsupported role ${control.ariaRole}`);
  return page
    .getByRole(control.ariaRole, {
      name: control.accessibleName,
      exact: true,
    })
    .nth(occurrenceFrom(control.controlKey) - 1);
};

const representativeValueFor = (control: ControlActionTarget): string => {
  if (control.inputType === "email") return "runtime-sweep@example.invalid";
  if (control.inputType === "number") return "1";
  if (control.inputType === "date") return "2026-01-01";
  if (control.inputType === "url") return "https://example.invalid";
  return "Runtime sweep";
};

const fillOrSelect = async (
  locator: Locator,
  input: ControlActionInput,
  timeoutMs: number,
): Promise<void> => {
  if (input.action.operation === "fill") {
    await locator.fill(input.value ?? representativeValueFor(input.control), {
      timeout: timeoutMs,
    });
    return;
  }
  if (input.action.operation === "select")
    await locator.selectOption({ index: 0 }, { timeout: timeoutMs });
};

const confirmStatefulAction = async (
  page: Page,
  operation: StatefulControlOperation,
  timeoutMs: number,
): Promise<void> => {
  const dialog = page.getByRole("alertdialog").last();
  if ((await dialog.count()) === 0)
    throw new ControlActionPolicyError(
      `Destructive ${operation} action did not present a confirmation dialog`,
    );
  const confirm = dialog
    .getByRole("button", { name: CONFIRMATION_NAMES[operation] })
    .first();
  if ((await confirm.count()) === 0)
    throw new ControlActionPolicyError(
      `Confirmation dialog for ${operation} has no matching button`,
    );
  await confirm.click({ timeout: timeoutMs });
};

const bounded = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    const signal = AbortSignal.timeout(timeoutMs);
    signal.addEventListener(
      "abort",
      () =>
        reject(
          new ControlActionTimeoutError(
            `Control action exceeded ${timeoutMs}ms`,
          ),
        ),
      { once: true },
    );
  });
  return Promise.race([operation, timeout]);
};

export const executeControlAttempt = async (
  input: ControlActionInput,
  locator: Locator,
  timeoutMs: number,
): Promise<ControlActionObservation | "ambiguous"> => {
  const { action, page, observeOutcome } = input;
  try {
    if (action.operation === "fill" || action.operation === "select")
      await fillOrSelect(locator, input, timeoutMs);
    else await locator.click({ timeout: timeoutMs });
    if (isStateful(action.operation))
      await confirmStatefulAction(page, action.operation, timeoutMs);
    if (observeOutcome === undefined)
      return requiresControlRecovery(input) ? "ambiguous" : "pass";
    return await bounded(observeOutcome(), timeoutMs);
  } catch {
    if (isStateful(action.operation)) return "ambiguous";
    return "fail";
  }
};
