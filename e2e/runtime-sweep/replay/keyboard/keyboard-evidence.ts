import type { Page } from "@playwright/test";

import {
  type DomControlObservation,
  inventoryDom,
} from "../dom/dom-inventory.ts";
import {
  activeElementDescription,
  type FocusedControl,
  focusedControl,
} from "./focused-control.ts";
import type { KeyboardFocusPolicy } from "./keyboard-focus-policy.ts";

const NON_TAB_FOCUS_ROLES = new Set([
  "alertdialog",
  "dialog",
  "menu",
  "option",
  "tabpanel",
]);
const MAX_TAB_STEPS = 2;
const MENU_ITEM_ROLES = new Set([
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
]);
const DISCLOSURE_FOCUSABLE =
  ":is(a[href],button,input,select,textarea,summary,[contenteditable]:not([contenteditable='false']),[tabindex]):not(:disabled):not([aria-disabled='true']):not([tabindex='-1'])";

export type KeyboardControlEvidence = Readonly<{
  controlKey: string;
  role: string;
  accessibleName: string;
  enabled: boolean;
  expectedFocusable: boolean;
  focusable: boolean;
  focusPolicy: KeyboardFocusPolicy;
  outcome: "pass" | "fail" | "not-applicable";
}>;

export interface KeyboardTrace {
  readonly after: string;
  readonly before: string;
  readonly focusMoved: boolean;
  readonly controls: readonly KeyboardControlEvidence[];
  readonly focusGaps: readonly KeyboardControlEvidence[];
}

const blurActiveElement = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });

const KEYBOARD_START_MARKER = "runtime-sweep-keyboard-start";

const focusDocumentStart = (page: Page): Promise<void> =>
  page.evaluate((markerId: string) => {
    if (document.getElementById(markerId) !== null)
      throw new Error(`Keyboard trace marker ${markerId} already exists`);
    const marker = document.createElement("span");
    marker.id = markerId;
    marker.tabIndex = 0;
    marker.setAttribute("aria-hidden", "true");
    marker.style.position = "fixed";
    marker.style.width = "1px";
    marker.style.height = "1px";
    marker.style.overflow = "hidden";
    document.body.prepend(marker);
    marker.focus({ preventScroll: true });
  }, KEYBOARD_START_MARKER);

const removeDocumentStart = (page: Page): Promise<void> =>
  page.evaluate((markerId: string) => {
    document.getElementById(markerId)?.remove();
  }, KEYBOARD_START_MARKER);

const focusPolicyFor = (
  control: DomControlObservation,
): KeyboardFocusPolicy => {
  if (control.keyboardFocusPolicy !== undefined) {
    return control.keyboardFocusPolicy;
  }
  const expectedFocusable =
    control.keyboardExpectedFocusable ??
    (control.enabled && !NON_TAB_FOCUS_ROLES.has(control.role));
  return expectedFocusable ? "required" : "unreachable";
};

const outcomeFor = (
  policy: KeyboardFocusPolicy,
  focusable: boolean,
): "pass" | "fail" | "not-applicable" => {
  switch (policy) {
    case "required":
      return focusable ? "pass" : "fail";
    case "forbidden":
      return focusable ? "fail" : "not-applicable";
    case "unreachable":
      return "not-applicable";
    default:
      return assertNever(policy);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Unknown keyboard focus policy: ${String(value)}`);
};

const tabSequence = async (
  page: Page,
  steps: number,
): Promise<readonly FocusedControl[]> =>
  Array.from({ length: steps }, (_, index) => index).reduce(
    async (promise, _step) => {
      const sequence = await promise;
      await page.keyboard.press("Tab");
      const control = await focusedControl(page);
      return control ? [...sequence, control] : sequence;
    },
    Promise.resolve<readonly FocusedControl[]>([]),
  );

const expandedDisclosureSequence = async (
  page: Page,
): Promise<readonly FocusedControl[]> => {
  const steps = await page.evaluate((focusableSelector) => {
    const active = document.activeElement;
    if (
      !(active instanceof HTMLElement) ||
      active.getAttribute("aria-expanded")?.toLowerCase() !== "true"
    )
      return 0;
    const controlledId = active.getAttribute("aria-controls")?.trim();
    const target = controlledId
      ? document.getElementById(controlledId)
      : active.nextElementSibling;
    if (!(target instanceof HTMLElement)) return 0;
    return Array.from(
      target.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element.checkVisibility()).length;
  }, DISCLOSURE_FOCUSABLE);
  return tabSequence(page, steps);
};

const menuSequence = async (
  page: Page,
  controls: readonly DomControlObservation[],
): Promise<readonly FocusedControl[]> => {
  const active = await focusedControl(page);
  if (
    active === null ||
    (active.role !== "menu" && !MENU_ITEM_ROLES.has(active.role))
  )
    return [];
  const menuItems = controls.filter(({ role }) => MENU_ITEM_ROLES.has(role));
  const initial = MENU_ITEM_ROLES.has(active.role) ? [active] : [];
  return Array.from({ length: menuItems.length }, (_, index) => index).reduce(
    async (promise, _step) => {
      const sequence = await promise;
      await page.keyboard.press("ArrowDown");
      const control = await focusedControl(page);
      return control ? [...sequence, control] : sequence;
    },
    Promise.resolve<readonly FocusedControl[]>(initial),
  );
};

const controlsEvidence = (
  controls: readonly DomControlObservation[],
  focusedKeys: ReadonlySet<string>,
): readonly KeyboardControlEvidence[] =>
  controls.map((control) => {
    const focusPolicy = focusPolicyFor(control);
    const focusable = focusedKeys.has(control.controlKey);
    return {
      controlKey: control.controlKey,
      role: control.role,
      accessibleName: control.accessibleName,
      enabled: control.enabled,
      expectedFocusable: focusPolicy === "required",
      focusable,
      focusPolicy,
      outcome: outcomeFor(focusPolicy, focusable),
    };
  });

export async function captureKeyboardTrace(
  page: Page,
  controls?: readonly DomControlObservation[],
): Promise<KeyboardTrace> {
  const resolvedControls = controls ?? (await inventoryDom(page)).controls;
  const before = await activeElementDescription(page);
  const initialFocusedControl = await focusedControl(page);
  const menuFocusSequence = await menuSequence(page, resolvedControls);
  const disclosureFocusSequence = await expandedDisclosureSequence(page);
  await blurActiveElement(page);
  await focusDocumentStart(page);
  try {
    const sequence = await tabSequence(
      page,
      Math.max(1, resolvedControls.length * MAX_TAB_STEPS + 1),
    );
    const after =
      sequence[0] === undefined
        ? await activeElementDescription(page)
        : `${sequence[0].role}:${sequence[0].accessibleName}`;
    const observedFocusSequence = [
      ...menuFocusSequence,
      ...disclosureFocusSequence,
      ...sequence,
    ];
    const focusedKeys = new Set(
      observedFocusSequence.map(({ controlKey }) => controlKey),
    );
    const evidence = controlsEvidence(resolvedControls, focusedKeys);
    return {
      after,
      before,
      focusMoved:
        observedFocusSequence.length > 0 &&
        (initialFocusedControl === null ||
          observedFocusSequence.some(
            ({ controlKey }) => controlKey !== initialFocusedControl.controlKey,
          )),
      controls: evidence,
      focusGaps: evidence.filter(({ outcome }) => outcome === "fail"),
    };
  } finally {
    await removeDocumentStart(page);
    await blurActiveElement(page);
  }
}
