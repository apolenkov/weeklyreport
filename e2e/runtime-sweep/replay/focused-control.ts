import type { Page } from "@playwright/test";

import { SOURCE_TEXT_HELPER_SCRIPT } from "./dom-inventory.ts";

export type FocusedControl = Readonly<{
  controlKey: string;
  role: string;
  accessibleName: string;
}>;

const FOCUSED_CONTROL_SCRIPT = String.raw`(() => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const sourceText = ${SOURCE_TEXT_HELPER_SCRIPT};
  const normalize = (value) => (value ?? "").replaceAll(/\s+/gu, " ").trim();
  const roleFor = (element) => {
    const explicit = element.getAttribute("role")?.trim().split(/\s+/).at(0);
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "button" || tag === "summary") return "button";
    if (tag === "select") return element.multiple ? "listbox" : "combobox";
    if (tag === "textarea" || element.isContentEditable) return "textbox";
    if (tag === "option") return "option";
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
    if (labelledBy !== null)
      return normalize(labelledBy.split(/\s+/u)
        .map((id) => document.getElementById(id))
        .map((label) => label === null ? "" :
          sourceText.text(label, sourceText.isHidden(label))).join(" "));
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel !== null) return normalize(ariaLabel);
    const id = element.getAttribute("id");
    const label = id ? Array.from(document.querySelectorAll("label"))
      .find((candidate) => candidate.htmlFor === id) : element.closest("label");
    const labelText = label == null ? "" :
      sourceText.text(label, sourceText.isHidden(label));
    if (normalize(labelText) !== "") return normalize(labelText);
    const imageAlt = element.querySelector("img[alt]")?.getAttribute("alt") ?? null;
    const inputValue = element instanceof HTMLInputElement &&
      ["button", "image", "reset", "submit"].includes(element.type)
        ? element.value || element.alt : null;
    const namedValue = [element.getAttribute("title"), imageAlt, inputValue]
      .map((value) => normalize(value)).find((value) => value !== "");
    if (namedValue !== undefined) return namedValue;
    if (["alertdialog", "dialog", "menu", "tabpanel"].includes(roleFor(element)))
      return "";
    return normalize(sourceText.text(element));
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

export const focusedControl = (page: Page): Promise<FocusedControl | null> =>
  page.evaluate<FocusedControl | null>(FOCUSED_CONTROL_SCRIPT);

export const activeElementDescription = async (page: Page): Promise<string> => {
  const focused = await focusedControl(page);
  return focused === null
    ? "none"
    : `${focused.role}:${focused.accessibleName}`;
};
