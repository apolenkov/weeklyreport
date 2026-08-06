import type { Locator, Page } from "@playwright/test";

import { type ActionOperation } from "../source/contracts.ts";
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

const isSupportedRole = (role: string): role is SupportedControlRole =>
  (SUPPORTED_CONTROL_ROLES as readonly string[]).includes(role);

const occurrenceFrom = (controlKey: string): number => {
  const match = /:(\d+)$/u.exec(controlKey);
  const value = Number(match?.[1] ?? DEFAULT_OCCURRENCE);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_OCCURRENCE;
};

const TITLE_ROLE_SELECTORS: Readonly<
  Partial<Record<SupportedControlRole, string>>
> = {
  link: "a",
  button:
    "button,[role='button'],input[type='button'],input[type='submit'],input[type='reset']",
  checkbox: "input[type='checkbox'],[role='checkbox']",
  radio: "input[type='radio'],[role='radio']",
  switch: "[role='switch']",
};

const titleSelectorFor = (role: SupportedControlRole): string =>
  TITLE_ROLE_SELECTORS[role] ?? `[role='${role}']`;

const isSkipToContentLink = (control: ControlActionTarget): boolean =>
  control.ariaRole === "link" &&
  control.accessibleName.trim().toLocaleLowerCase() === "skip to content";

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

export const titleTargetLocator = (
  page: Page,
  control: ControlActionTarget,
): Locator => {
  if (!isSupportedRole(control.ariaRole))
    throw new ControlActionPolicyError(`Unsupported role ${control.ariaRole}`);
  return page
    .locator(
      `:is(${titleSelectorFor(control.ariaRole)})[title=${JSON.stringify(control.accessibleName)}]`,
    )
    .nth(occurrenceFrom(control.controlKey) - 1);
};

export const innerTextTargetLocator = async (
  page: Page,
  control: ControlActionTarget,
): Promise<Locator | undefined> => {
  if (!isSupportedRole(control.ariaRole))
    throw new ControlActionPolicyError(`Unsupported role ${control.ariaRole}`);
  const candidates = page.locator(titleSelectorFor(control.ariaRole));
  const matchingIndexes = await candidates.evaluateAll(
    (elements, expectedName) => {
      const normalize = (value: string): string =>
        value.replaceAll(/\s+/gu, " ").trim();
      return elements.flatMap((element, index) => {
        if (!(element instanceof HTMLElement)) return [];
        const bounds = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const visible =
          element.closest("[hidden],[aria-hidden='true']") === null &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.visibility !== "collapse" &&
          Number(style.opacity) !== 0 &&
          bounds.width > 0 &&
          bounds.height > 0;
        return visible &&
          normalize(element.innerText) === normalize(expectedName)
          ? [index]
          : [];
      });
    },
    control.accessibleName,
  );
  const index = matchingIndexes[occurrenceFrom(control.controlKey) - 1];
  return index === undefined ? undefined : candidates.nth(index);
};

export const hrefTargetLocator = (
  page: Page,
  control: ControlActionTarget,
): Locator | undefined => {
  if (
    control.ariaRole !== "link" ||
    control.href === null ||
    control.href === undefined
  )
    return undefined;
  return page
    .locator(`a[href=${JSON.stringify(control.href)}]`)
    .nth(occurrenceFrom(control.controlKey) - 1);
};

export const waitForVisible = async (
  locator: Locator,
  timeoutMs: number,
): Promise<boolean> => {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "TimeoutError") return false;
    throw error;
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

const activateControl = async (
  page: Page,
  locator: Locator,
  control: ControlActionTarget,
  timeoutMs: number,
): Promise<void> => {
  if (!isSkipToContentLink(control)) {
    await locator.click({ timeout: timeoutMs });
    return;
  }
  await locator.focus({ timeout: timeoutMs });
  await page.keyboard.press("Enter");
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

const failedAttemptFor = (
  action: ActionOperation,
  error: unknown,
): ControlActionAttempt => ({
  status: isStateful(action) ? "ambiguous" : "fail",
  reason: error instanceof Error ? error.message : "The control action failed",
});

export const executeControlAttempt = async (
  input: ControlActionInput,
  locator: Locator,
  timeoutMs: number,
): Promise<ControlActionAttempt> => {
  const { action, page, observeOutcome } = input;
  try {
    if (action.operation === "fill" || action.operation === "select")
      await fillOrSelect(locator, input, timeoutMs);
    else await activateControl(page, locator, input.control, timeoutMs);
    if (isStateful(action.operation))
      await confirmStatefulAction(page, action.operation, timeoutMs);
    if (observeOutcome === undefined)
      return requiresControlRecovery(input) ? "ambiguous" : "pass";
    return await bounded(observeOutcome(), timeoutMs);
  } catch (error: unknown) {
    return failedAttemptFor(action.operation, error);
  }
};
