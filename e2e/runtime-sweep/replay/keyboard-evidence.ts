import type { Page } from "@playwright/test";

import { type DomControlObservation, inventoryDom } from "./dom-inventory.ts";
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

type FocusedControl = Readonly<{
  controlKey: string;
  role: string;
  accessibleName: string;
}>;

const FOCUSED_CONTROL_SCRIPT = String.raw`(() => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const readableText = (node) =>
    node instanceof HTMLElement && node.innerText ? node.innerText : node?.textContent || "";
  const roleFor = (element) => {
    const explicit = element.getAttribute("role")?.trim().split(/\s+/).at(0);
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "select") return element.multiple ? "listbox" : "combobox";
    if (tag === "textarea" || element.isContentEditable) return "textbox";
    if (tag !== "input") return "";
    const type = element.type.toLowerCase();
    if (["button","image","reset","submit"].includes(type)) return "button";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "range") return "slider";
    if (type === "number") return "spinbutton";
    if (type === "search") return "searchbox";
    return "textbox";
  };
  const nameFor = (element) => {
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy.split(/\s+/)
        .map((id) => readableText(document.getElementById(id)))
        .join(" ").replaceAll(/\s+/g, " ").trim();
      if (text) return text;
    }
    const ariaLabel = element.getAttribute("aria-label")?.trim();
    if (ariaLabel) return ariaLabel;
    const id = element.getAttribute("id");
    const label = id
      ? Array.from(document.querySelectorAll("label")).find((candidate) => candidate.htmlFor === id)
      : element.closest("label");
    const labelText = readableText(label).replaceAll(/\s+/g, " ").trim();
    if (labelText) return labelText;
    const title = element.getAttribute("title")?.trim();
    if (title) return title;
    return readableText(element).replaceAll(/\s+/g, " ").trim();
  };
  const elements = Array.from(document.querySelectorAll(
    "a[href],button,input,select,textarea,option,summary,[contenteditable]:not([contenteditable='false']),[role]"
  )).filter((element) => {
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" &&
      !element.closest("[hidden],[aria-hidden='true']") && bounds.width > 0 && bounds.height > 0;
  });
  const activeIndex = elements.findIndex((element) => element === active);
  if (activeIndex === -1) return null;
  const role = roleFor(active);
  if (!role) return null;
  const accessibleName = nameFor(active);
  const occurrence = elements.slice(0, activeIndex)
    .filter((element) => roleFor(element) === role && nameFor(element) === accessibleName).length + 1;
  return {
    controlKey: role + ":" + encodeURIComponent(accessibleName || "(unnamed)") + ":" + occurrence,
    role,
    accessibleName,
  };
})()`;

const activeElement = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return "none";
    const role = active.getAttribute("role") ?? active.tagName.toLowerCase();
    const name = active.getAttribute("aria-label") ?? active.innerText.trim();
    return `${role}:${name}`;
  });

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

const focusedControl = (page: Page): Promise<FocusedControl | null> =>
  page.evaluate<FocusedControl | null>(FOCUSED_CONTROL_SCRIPT);

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
  const before = await activeElement(page);
  const menuFocusSequence = await menuSequence(page, resolvedControls);
  await blurActiveElement(page);
  await focusDocumentStart(page);
  try {
    const sequence = await tabSequence(
      page,
      Math.max(1, resolvedControls.length * MAX_TAB_STEPS + 1),
    );
    const after =
      sequence[0] === undefined
        ? await activeElement(page)
        : `${sequence[0].role}:${sequence[0].accessibleName}`;
    const focusedKeys = new Set(
      [...menuFocusSequence, ...sequence].map(({ controlKey }) => controlKey),
    );
    const evidence = controlsEvidence(resolvedControls, focusedKeys);
    return {
      after,
      before,
      focusMoved: before !== after && after !== "none",
      controls: evidence,
      focusGaps: evidence.filter(({ outcome }) => outcome === "fail"),
    };
  } finally {
    await removeDocumentStart(page);
    await blurActiveElement(page);
  }
}
