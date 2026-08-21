import { randomUUID } from "node:crypto";

import type { ElementHandle, Locator, Page } from "@playwright/test";

import {
  SUPPORTED_CONTROL_ROLES,
  type SupportedControlRole,
} from "../control-actions/control-action-roles.ts";
import type {
  ControlActionTarget,
  RenderedNameActionLease,
  RenderedTargetValidator,
} from "../control-actions/control-action-types.ts";
import { ControlActionPolicyError } from "../recovery/control-recovery.ts";
import {
  armRenderedNameHandle as armRenderedNameState,
  RENDERED_TARGET_GUARD_PROPERTY,
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

interface RenderedNameExpectation {
  readonly generation: string;
  readonly name: string;
  readonly roleName: string;
  readonly roleSelector: string;
  readonly validatorProperty: string;
}

const evaluateRenderedName = (
  element: Node,
  expected: RenderedNameExpectation,
): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  const normalize = (value: string | null): string =>
    (value ?? "").replaceAll(/\s+/gu, " ").trim();
  const readableText = (target: Element): string =>
    target instanceof HTMLElement && target.innerText
      ? target.innerText
      : target.textContent;
  const inventoryNameFor = (target: HTMLElement): string => {
    const labelledBy = target.getAttribute("aria-labelledby");
    if (labelledBy !== null)
      return normalize(
        labelledBy
          .split(/\s+/u)
          .map((id) => document.getElementById(id))
          .map((label) => (label === null ? "" : readableText(label)))
          .join(" "),
      );
    const ariaLabel = target.getAttribute("aria-label");
    if (ariaLabel !== null) return normalize(ariaLabel);
    const explicitLabel = target.id
      ? [...document.querySelectorAll("label")].find(
          (label) => label.htmlFor === target.id,
        )
      : undefined;
    const labelText = (explicitLabel ?? target.closest("label"))?.innerText;
    if (normalize(labelText ?? null) !== "")
      return normalize(labelText ?? null);
    const imageAlt =
      target.querySelector("img[alt]")?.getAttribute("alt") ?? null;
    const inputValue =
      target instanceof HTMLInputElement &&
      ["button", "image", "reset", "submit"].includes(target.type)
        ? target.value || target.alt
        : null;
    const namedValue = [target.title, imageAlt, inputValue]
      .map((value) => normalize(value))
      .find((value) => value !== "");
    if (namedValue !== undefined) return namedValue;
    if (expected.roleName === "alertdialog") return "";
    return normalize(readableText(target));
  };
  const matchesCurrent = (): boolean => {
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const visible = [
      element.closest("[hidden],[aria-hidden='true']") === null &&
        style.display !== "none",
      !["hidden", "collapse"].includes(style.visibility),
      Number(style.opacity) !== 0 && bounds.width > 0 && bounds.height > 0,
    ].every(Boolean);
    return (
      element.matches(expected.roleSelector) &&
      (document.fullscreenElement?.contains(element) ?? true) &&
      visible &&
      inventoryNameFor(element) === expected.name
    );
  };
  if (!matchesCurrent()) return false;
  Object.assign(matchesCurrent, { generation: expected.generation });
  Object.defineProperty(element, expected.validatorProperty, {
    configurable: true,
    value: matchesCurrent,
  });
  return true;
};

const cleanupDiscoveryValidator = (
  handle: ElementHandle<HTMLElement>,
  generation: string,
): Promise<void> =>
  handle.evaluate(
    (element, expected) => {
      const guarded = element as HTMLElement & Record<string, unknown>;
      const validator = guarded[expected.validatorProperty] as
        RenderedTargetValidator | undefined;
      const guard = guarded[expected.guardProperty] as
        { readonly validator?: unknown } | undefined;
      if (
        validator?.generation === expected.generation &&
        guard?.validator !== validator
      )
        delete guarded[expected.validatorProperty];
    },
    {
      generation,
      guardProperty: RENDERED_TARGET_GUARD_PROPERTY,
      validatorProperty: RENDERED_TARGET_VALIDATOR_PROPERTY,
    },
  );

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
  handles: readonly ElementHandle[],
  expectedName: string,
  roleName: string,
  roleSelector: string,
  occurrence: number,
  signal?: AbortSignal,
): Promise<ElementHandle<HTMLElement> | undefined> => {
  const matches: ElementHandle<HTMLElement>[] = [];
  for (const handle of handles) {
    if (signal?.aborted === true) {
      await releaseRenderedNameTarget(handle as ElementHandle<HTMLElement>);
      continue;
    }
    const generation = randomUUID();
    try {
      if (
        await handle.evaluate(evaluateRenderedName, {
          generation,
          name: expectedName,
          roleName,
          roleSelector,
          validatorProperty: RENDERED_TARGET_VALIDATOR_PROPERTY,
        })
      ) {
        const renderedHandle = handle as ElementHandle<HTMLElement>;
        discoveryGenerations.set(renderedHandle, generation);
        matches.push(renderedHandle);
        continue;
      }
    } catch {
      // A detached handle is a stale candidate, never an action target.
    }
    await handle.dispose();
  }
  const selected = matches[occurrence - 1];
  await Promise.all(
    matches
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
