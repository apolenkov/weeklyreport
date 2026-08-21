import { randomUUID } from "node:crypto";

import type { ElementHandle, Locator, Page } from "@playwright/test";

import {
  SUPPORTED_CONTROL_ROLES,
  type SupportedControlRole,
} from "../control-actions/control-action-roles.ts";
import type {
  ControlActionTarget,
  RenderedNameActionLease,
} from "../control-actions/control-action-types.ts";
import { ControlActionPolicyError } from "../recovery/control-recovery.ts";
import { cleanupDiscoveryValidator } from "./rendered-control-discovery-cleanup.ts";
import {
  evaluateRenderedNameHandle,
  INSTALL_RENDERED_NAME_EVALUATOR_SCRIPT,
  REMOVE_RENDERED_NAME_EVALUATOR_SCRIPT,
  type RenderedNameEvaluationInput,
} from "./rendered-control-name-evaluator.ts";
import {
  armRenderedNameHandle as armRenderedNameState,
  RENDERED_TARGET_VALIDATOR_PROPERTY,
} from "./rendered-control-state.ts";

export type { RenderedNameActionLease } from "../control-actions/control-action-types.ts";
export {
  beginRenderedNameAction,
  cleanupRenderedNameGuard,
  completeRenderedNameAction,
} from "./rendered-control-state.ts";

const discoveryGenerations = new WeakMap<ElementHandle<HTMLElement>, string>();

export const armRenderedNameHandle = (
  handle: ElementHandle<HTMLElement>,
  activationDeadline: number,
): Promise<RenderedNameActionLease | undefined> => {
  const discoveryGeneration = discoveryGenerations.get(handle);
  return discoveryGeneration === undefined
    ? Promise.resolve(undefined)
    : armRenderedNameState(handle, activationDeadline, discoveryGeneration);
};

const occurrenceFrom = (controlKey: string): number => {
  const value = Number(/:(\d+)$/u.exec(controlKey)?.[1] ?? 1);
  return Number.isInteger(value) && value > 0 ? value : 1;
};

const IMPLICIT_ROLE_SELECTORS: Readonly<
  Partial<Record<SupportedControlRole, string>>
> = {
  button:
    "button:not([role]),summary:not([role]),input:is([type='button'],[type='image'],[type='reset'],[type='submit']):not([role])",
  checkbox: "input[type='checkbox']:not([role])",
  combobox: "select:not([multiple]):not([role])",
  link: "a[href]:not([role])",
  listbox: "select[multiple]:not([role])",
  option: "option:not([role])",
  radio: "input[type='radio']:not([role])",
  searchbox: "input[type='search']:not([role])",
  slider: "input[type='range']:not([role])",
  spinbutton: "input[type='number']:not([role])",
  textbox:
    "input:not([role]):not([type='hidden']):not([type='button']):not([type='image']):not([type='reset']):not([type='submit']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='number']):not([type='search']),textarea:not([role]),[contenteditable]:not([contenteditable='false']):not([role])",
};

const inventoryRoleSelector = (roleName: string): string => {
  if (!(SUPPORTED_CONTROL_ROLES as readonly string[]).includes(roleName))
    throw new TypeError(`Unsupported role ${roleName}`);
  const role = roleName as SupportedControlRole;
  const explicit = `[role='${role}'],[role^='${role} ']`;
  const implicit = IMPLICIT_ROLE_SELECTORS[role];
  const selectors = [explicit, ...(implicit === undefined ? [] : [implicit])];
  return `:is(${selectors.join(",")})`;
};

const fullscreenInteractionSelector = (selector: string): string =>
  `:root:not(:has(:fullscreen)) ${selector}, :fullscreen:is(${selector}), :fullscreen ${selector}`;

const roleTargetLocator = (page: Page, roleName: string): Locator =>
  page.locator(fullscreenInteractionSelector(inventoryRoleSelector(roleName)));

const exactRenderedText = (value: string): RegExp => {
  const normalized = value
    .trim()
    .replaceAll(/\s+/gu, " ")
    .replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(String.raw`^\s*${normalized}\s*$`, "u");
};

const isSupportedRole = (role: string): role is SupportedControlRole =>
  (SUPPORTED_CONTROL_ROLES as readonly string[]).includes(role);

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
    .and(roleTargetLocator(page, control.ariaRole))
    .nth(occurrenceFrom(control.controlKey) - 1);
};

/**
 * Resolve a control using the DOM semantics used by inventoryDom.
 *
 * Playwright's accessibility tree can expose a native summary as `generic`
 * while inventoryDom intentionally records it as an implicit button. The
 * readiness path therefore adds a summary-only fallback; action execution
 * continues to use targetLocator and its stricter accessibility intersection.
 */
export const inventoryTargetLocator = (
  page: Page,
  control: ControlActionTarget,
): Locator => {
  const target = targetLocator(page, control);
  if (control.ariaRole !== "button") return target;
  const summary = page
    .locator(fullscreenInteractionSelector("summary:not([role])"))
    .filter({ hasText: exactRenderedText(control.accessibleName) });
  return target.or(summary).nth(occurrenceFrom(control.controlKey) - 1);
};

export const titleTargetLocator = (
  page: Page,
  control: ControlActionTarget,
): Locator =>
  roleTargetLocator(page, control.ariaRole)
    .and(page.locator(`[title=${JSON.stringify(control.accessibleName)}]`))
    .nth(occurrenceFrom(control.controlKey) - 1);

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
  return roleTargetLocator(page, "link")
    .and(page.locator(`a[href=${JSON.stringify(control.href)}]`))
    .nth(occurrenceFrom(control.controlKey) - 1);
};

export const releaseRenderedNameTarget = async (
  handle: ElementHandle<HTMLElement>,
): Promise<void> => {
  const generation = discoveryGenerations.get(handle);
  try {
    if (generation !== undefined)
      await cleanupDiscoveryValidator(handle, generation);
  } finally {
    discoveryGenerations.delete(handle);
    await handle.dispose();
  }
};

const matchingHandle = async (
  page: Page,
  handles: readonly ElementHandle[],
  expectedName: string,
  roleName: string,
  roleSelector: string,
  occurrence: number,
  signal?: AbortSignal,
): Promise<ElementHandle<HTMLElement> | undefined> => {
  if (Boolean(signal?.aborted)) {
    await Promise.all(handles.map((handle) => handle.dispose()));
    return undefined;
  }
  const matchingHandles: ElementHandle<HTMLElement>[] = [];
  await page.evaluate(INSTALL_RENDERED_NAME_EVALUATOR_SCRIPT);
  try {
    for (const handle of handles) {
      if (Boolean(signal?.aborted)) {
        await handle.dispose();
        continue;
      }
      const generation = randomUUID();
      const renderedHandle = handle as ElementHandle<HTMLElement>;
      try {
        const expected: RenderedNameEvaluationInput = {
          generation,
          name: expectedName,
          roleName,
          roleSelector,
          validatorProperty: RENDERED_TARGET_VALIDATOR_PROPERTY,
        };
        if (await evaluateRenderedNameHandle(page, renderedHandle, expected)) {
          discoveryGenerations.set(renderedHandle, generation);
          matchingHandles.push(renderedHandle);
          continue;
        }
      } catch {
        // A detached handle is a stale candidate, never an action target.
      }
      await handle.dispose();
    }
  } finally {
    await page.evaluate(REMOVE_RENDERED_NAME_EVALUATOR_SCRIPT);
  }
  const abortedAfterDiscovery = Boolean(signal?.aborted);
  if (abortedAfterDiscovery) {
    await Promise.all(
      matchingHandles.map((handle) => releaseRenderedNameTarget(handle)),
    );
    return undefined;
  }
  const selected = matchingHandles[occurrence - 1];
  await Promise.all(
    matchingHandles
      .filter((handle) => handle !== selected)
      .map((handle) => releaseRenderedNameTarget(handle)),
  );
  return selected;
};

export const renderedNameTargetHandle = async (
  page: Page,
  control: ControlActionTarget,
  signal?: AbortSignal,
): Promise<ElementHandle<HTMLElement> | undefined> => {
  const expectedName = control.accessibleName.replaceAll(/\s+/gu, " ").trim();
  const roleSelector = inventoryRoleSelector(control.ariaRole);
  const selected = await matchingHandle(
    page,
    await roleTargetLocator(page, control.ariaRole).elementHandles(),
    expectedName,
    control.ariaRole,
    roleSelector,
    occurrenceFrom(control.controlKey),
    signal,
  );
  if (signal?.aborted !== true) return selected;
  if (selected !== undefined) await releaseRenderedNameTarget(selected);
  return undefined;
};
