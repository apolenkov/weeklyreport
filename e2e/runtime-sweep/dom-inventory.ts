import type { Page } from "@playwright/test";

const LANDMARK_ROLES: ReadonlySet<string> = new Set([
  "alertdialog",
  "dialog",
  "menu",
  "tabpanel",
]);

const ORDER_WIDTH = 4;

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
}

const normalizeText = (value: string | null): string =>
  (value ?? "").replaceAll(/\s+/g, " ").trim();

const INVENTORY_SCRIPT = String.raw`(() => {
  const interactive = ["button","checkbox","combobox","gridcell","link","listbox",
    "menuitem","menuitemcheckbox","menuitemradio","option","radio","scrollbar",
    "searchbox","slider","spinbutton","switch","tab","textbox","treeitem"];
  const landmarks = ["alertdialog","dialog","menu","tabpanel"];
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
  const elements = Array.from(document.querySelectorAll(
    "a[href],button,input,select,textarea,option,summary,[contenteditable]:not([contenteditable='false']),[role]"));
  return elements.map((element) => {
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
    const labels = Array.from(document.querySelectorAll("label"));
    const labelText = element.id ? labels.find((label) => label.htmlFor === element.id)?.textContent
      || null : element.closest("label")?.textContent || null;
    const imageAlt = element.querySelector("img[alt]")?.getAttribute("alt") || null;
    const value = element instanceof HTMLInputElement &&
      ["button","image","reset","submit"].includes(inputType || "")
      ? element.value || element.alt : null;
    return { role, tagName, inputType,
      href: element instanceof HTMLAnchorElement ? element.getAttribute("href") : null,
      ariaLabel: element.getAttribute("aria-label"), labelledByText, labelText,
      title: element.getAttribute("title"), imageAlt, value,
      text: element.textContent || "", visible,
      disabled: element.matches(":disabled") || element.getAttribute("aria-disabled") === "true" };
  }).filter((element) => element.visible &&
    (interactive.includes(element.role) || landmarks.includes(element.role)));
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

export async function inventoryDom(page: Page): Promise<DomInventory> {
  const rawElements =
    await page.evaluate<readonly RawDomElement[]>(INVENTORY_SCRIPT);
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
