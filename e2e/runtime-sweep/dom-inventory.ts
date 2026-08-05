import type { Page } from "@playwright/test";

const LANDMARK_ROLES: ReadonlySet<string> = new Set([
  "alertdialog",
  "dialog",
  "menu",
  "tabpanel",
]);

const ORDER_WIDTH = 4;
const INVENTORY_CONTEXT_ATTEMPTS = 3;

export type KeyboardFocusScope = "page" | "active-modal" | "background";

export interface DomControlObservation {
  readonly controlKey: string;
  readonly domOrderKey: string;
  readonly order: number;
  readonly role: string;
  readonly accessibleName: string;
  readonly enabled: boolean;
  readonly disabled: boolean;
  readonly visible: boolean;
  readonly tagName: string;
  readonly inputType: string | null;
  readonly href: string | null;
  readonly keyboardExpectedFocusable?: boolean;
  readonly keyboardFocusScope?: KeyboardFocusScope;
}

export interface DomInventoryIssue {
  readonly kind: "missing-accessible-name";
  readonly controlKey: string;
  readonly message: string;
}

export interface DomInventory {
  readonly controls: readonly DomControlObservation[];
  readonly issues: readonly DomInventoryIssue[];
}

interface RawDomElement {
  readonly role: string;
  readonly tagName: string;
  readonly inputType: string | null;
  readonly href: string | null;
  readonly ariaLabel: string | null;
  readonly labelledByText: string | null;
  readonly labelText: string | null;
  readonly title: string | null;
  readonly imageAlt: string | null;
  readonly value: string | null;
  readonly text: string;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly keyboardExpectedFocusable?: boolean;
  readonly keyboardFocusScope?: KeyboardFocusScope;
}

const normalizeText = (value: string | null): string =>
  (value ?? "").replaceAll(/\s+/g, " ").trim();

const INVENTORY_SCRIPT = String.raw`(() => {
  const interactive = ["button","checkbox","combobox","gridcell","link","listbox",
    "menuitem","menuitemcheckbox","menuitemradio","option","radio","scrollbar",
    "searchbox","slider","spinbutton","switch","tab","textbox","treeitem"];
  const landmarks = ["alertdialog","dialog","menu","tabpanel"];
  const nonTabRoles = new Set(["alertdialog","dialog","menu","option","tabpanel"]);
  const roleFor = (element) => {
    const explicit = element.getAttribute("role")?.trim().split(/\s+/).at(0);
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    const type = element instanceof HTMLInputElement ? element.type.toLowerCase() : "";
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "input") return type === "hidden" ? "" :
      ["button","image","reset","submit"].includes(type) ? "button" :
      type === "checkbox" ? "checkbox" : type === "radio" ? "radio" :
      type === "range" ? "slider" : type === "number" ? "spinbutton" :
      type === "search" ? "searchbox" : "textbox";
    if (tag === "select") return element.multiple ? "listbox" : "combobox";
    if (tag === "textarea" || element.isContentEditable) return "textbox";
    return tag === "option" ? "option" : "";
  };
  const labels = Array.from(document.querySelectorAll("label"));
  const formElements = Array.from(document.querySelectorAll("form"));
  const radioGroups = Array.from(document.querySelectorAll('[role="radiogroup"]'));
  const candidates = Array.from(document.querySelectorAll(
    "a[href],button,input,select,textarea,option,summary,[contenteditable]:not([contenteditable='false']),[role]"
  )).map((element) => {
    const tagName = element.tagName.toLowerCase();
    const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : null;
    const role = roleFor(element);
    const style = window.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const visible = !element.closest("[hidden],[aria-hidden='true']") &&
      style.display !== "none" && style.visibility !== "hidden" &&
      style.visibility !== "collapse" && Number(style.opacity) !== 0 &&
      bounds.width > 0 && bounds.height > 0;
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledByText = labelledBy ? labelledBy.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || "").join(" ") : null;
    const labelText = element.id ? labels.find((label) => label.htmlFor === element.id)?.textContent
      || null : element.closest("label")?.textContent || null;
    const imageAlt = element.querySelector("img[alt]")?.getAttribute("alt") || null;
    const value = element instanceof HTMLInputElement &&
      ["button","image","reset","submit"].includes(inputType || "")
      ? element.value || element.alt : null;
    return { element, role, tagName, inputType,
      href: element instanceof HTMLAnchorElement ? element.getAttribute("href") : null,
      ariaLabel: element.getAttribute("aria-label"), labelledByText, labelText,
      title: element.getAttribute("title"), imageAlt, value,
      text: element.textContent || "", visible,
      disabled: element.matches(":disabled") || element.getAttribute("aria-disabled") === "true",
      inert: Boolean(element.closest("[inert]")),
      tabIndex: element.tabIndex,
      explicitTabIndex: element.hasAttribute("tabindex"),
      checked: element instanceof HTMLInputElement
        ? element.checked
        : element.getAttribute("aria-checked")?.toLowerCase() === "true" };
  }).filter((element) => element.visible &&
    (interactive.includes(element.role) || landmarks.includes(element.role)));
  const activeModals = candidates.filter(({ element, role }) =>
    (role === "dialog" || role === "alertdialog") &&
    element.getAttribute("aria-modal")?.toLowerCase() === "true");
  const activeModal = activeModals.find(({ element }) => element.contains(document.activeElement))?.element
    || activeModals.at(-1)?.element
    || null;
  const scopeFor = (element) => activeModal === null
    ? "page"
    : activeModal.contains(element) ? "active-modal" : "background";
  const nativeRadioFor = (element) =>
    element instanceof HTMLInputElement && element.type.toLowerCase() === "radio";
  const groupKeyFor = (entry, index) => {
    if (entry.role !== "radio") return null;
    if (nativeRadioFor(entry.element)) {
      const name = entry.element.getAttribute("name")?.trim();
      if (!name) return "native:standalone:" + index;
      const formIndex = entry.element.form === null
        ? "document"
        : String(formElements.indexOf(entry.element.form));
      return "native:" + formIndex + ":" + name;
    }
    const group = entry.element.closest('[role="radiogroup"]');
    return group === null
      ? "aria:standalone:" + index
      : "aria:" + radioGroups.indexOf(group);
  };
  const entries = candidates.map((entry, index) => ({
    ...entry,
    focusScope: scopeFor(entry.element),
    radioGroupKey: groupKeyFor(entry, index),
    nativeRadio: nativeRadioFor(entry.element),
  }));
  const scopeAllowsTab = (entry) => activeModal === null || entry.focusScope === "active-modal";
  const radioGroupsByKey = new Map();
  entries.filter(({ radioGroupKey }) => radioGroupKey !== null).forEach((entry) => {
    const members = radioGroupsByKey.get(entry.radioGroupKey) || [];
    radioGroupsByKey.set(entry.radioGroupKey, [...members, entry]);
  });
  const radioTabStops = new Set();
  radioGroupsByKey.forEach((members) => {
    const candidatesForGroup = members.filter((entry) =>
      scopeAllowsTab(entry) && !entry.disabled && !entry.inert);
    if (candidatesForGroup.length === 0) return;
    const roving = members.some((entry) => !entry.nativeRadio && entry.explicitTabIndex);
    const tabEligible = candidatesForGroup.filter((entry) => entry.tabIndex >= 0);
    const tabStop = roving
      ? tabEligible.find((entry) => entry.tabIndex === 0) || tabEligible[0] || candidatesForGroup[0]
      : tabEligible.find((entry) => entry.checked) || tabEligible[0] || candidatesForGroup[0];
    radioTabStops.add(tabStop.element);
  });
  return entries.map((entry) => {
    const keyboardExpectedFocusable = entry.disabled || entry.inert ||
      !scopeAllowsTab(entry) || nonTabRoles.has(entry.role)
      ? false
      : entry.role !== "radio" || radioTabStops.has(entry.element);
    return { role: entry.role, tagName: entry.tagName, inputType: entry.inputType,
      href: entry.href, ariaLabel: entry.ariaLabel, labelledByText: entry.labelledByText,
      labelText: entry.labelText, title: entry.title, imageAlt: entry.imageAlt,
      value: entry.value, text: entry.text, visible: entry.visible,
      disabled: entry.disabled, keyboardExpectedFocusable,
      keyboardFocusScope: entry.focusScope };
  });
})()`;

const accessibleNameFor = (element: RawDomElement): string => {
  if (element.labelledByText !== null) {
    return normalizeText(element.labelledByText);
  }
  if (element.ariaLabel !== null) {
    return normalizeText(element.ariaLabel);
  }
  if (element.labelText !== null && normalizeText(element.labelText) !== "") {
    return normalizeText(element.labelText);
  }
  for (const value of [element.title, element.imageAlt, element.value]) {
    if (value !== null && normalizeText(value) !== "") {
      return normalizeText(value);
    }
  }
  return LANDMARK_ROLES.has(element.role) ? "" : normalizeText(element.text);
};

const controlFrom = (
  element: RawDomElement,
  order: number,
  occurrence: number,
): DomControlObservation => {
  const accessibleName = accessibleNameFor(element);
  const controlKey = [
    element.role,
    encodeURIComponent(accessibleName || "(unnamed)"),
    String(occurrence),
  ].join(":");
  return {
    controlKey,
    domOrderKey: `${String(order).padStart(ORDER_WIDTH, "0")}:${controlKey}`,
    order,
    role: element.role,
    accessibleName,
    enabled: !element.disabled,
    disabled: element.disabled,
    visible: element.visible,
    tagName: element.tagName,
    inputType: element.inputType,
    href: element.href,
    ...(element.keyboardExpectedFocusable === undefined
      ? {}
      : { keyboardExpectedFocusable: element.keyboardExpectedFocusable }),
    ...(element.keyboardFocusScope === undefined
      ? {}
      : { keyboardFocusScope: element.keyboardFocusScope }),
  };
};

const issuesFor = (
  controls: readonly DomControlObservation[],
): readonly DomInventoryIssue[] =>
  controls
    .filter((control) => control.accessibleName === "")
    .map((control) => ({
      kind: "missing-accessible-name",
      controlKey: control.controlKey,
      message: `Visible ${control.role} is missing an accessible name`,
    }));

const isNavigationContextLoss = (error: unknown): boolean =>
  error instanceof Error &&
  /Execution context was destroyed.*navigation/iu.test(error.message);

const inventoryElements = async (
  page: Page,
  attempts = INVENTORY_CONTEXT_ATTEMPTS,
): Promise<readonly RawDomElement[]> => {
  try {
    return await page.evaluate<readonly RawDomElement[]>(INVENTORY_SCRIPT);
  } catch (error: unknown) {
    if (attempts <= 1 || !isNavigationContextLoss(error)) {
      throw error;
    }
    await page.waitForLoadState("domcontentloaded");
    return inventoryElements(page, attempts - 1);
  }
};

export async function inventoryDom(page: Page): Promise<DomInventory> {
  const rawElements = await inventoryElements(page);
  const controls = rawElements.map((element, index) => {
    const occurrence =
      rawElements
        .slice(0, index)
        .filter(
          (other) =>
            other.role === element.role &&
            accessibleNameFor(other) === accessibleNameFor(element),
        ).length + 1;
    return controlFrom(element, index + 1, occurrence);
  });
  return { controls, issues: issuesFor(controls) };
}
