import { KEYBOARD_FOCUS_POLICY_SCRIPT } from "./keyboard-focus-policy.ts";

export const SOURCE_TEXT_HELPER_SCRIPT = String.raw`(() => {
  const isHidden = (element) => {
    if (element.closest("[hidden],[aria-hidden='true']") !== null) return true;
    let current = element;
    while (current instanceof Element) {
      const style = window.getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse"
      )
        return true;
      current = current.parentElement;
    }
    return false;
  };
  const appendSourcePiece = (result, piece) => {
    if (piece === "") return result;
    const previous = result.at(-1);
    const next = piece.at(0);
    const needsBoundarySpace =
      previous !== undefined &&
      next !== undefined &&
      !/\s/u.test(previous) &&
      !/^\s/u.test(piece) &&
      /[\p{L}\p{N}]/u.test(previous) &&
      /[\p{L}\p{N}]/u.test(next);
    return result + (needsBoundarySpace ? " " : "") + piece;
  };
  const text = (node, includeHiddenSubtree = false) =>
    Array.from(node.childNodes)
      .map((child) =>
        child.nodeType === Node.TEXT_NODE
          ? child.nodeValue || ""
          : child.nodeType === Node.ELEMENT_NODE &&
              (includeHiddenSubtree || !isHidden(child))
            ? text(child, includeHiddenSubtree)
            : "",
      )
      .reduce(appendSourcePiece, "");
  return { isHidden, text };
})()`;

export const INVENTORY_SCRIPT = String.raw`(() => {
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
  const labels = Array.from(document.querySelectorAll("label"));
  const sourceText = ${SOURCE_TEXT_HELPER_SCRIPT};
  const formElements = Array.from(document.querySelectorAll("form"));
  const radioGroups = Array.from(document.querySelectorAll('[role="radiogroup"]'));
  const elements = (() => {
  const candidates = Array.from(document.querySelectorAll(
    "a[href],button,input,select,textarea,option,summary,[contenteditable]:not([contenteditable='false']),[role]"
  )).map((element) => {
    const tagName = element.tagName.toLowerCase();
    const inputType = element instanceof HTMLInputElement ? element.type.toLowerCase() : null;
    const role = roleFor(element);
    const style = window.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const closedDetails = element.closest("details:not([open])");
    const visibleSummary =
      element.matches("summary") && element.parentElement === closedDetails;
    const visible = (closedDetails === null || visibleSummary) &&
      !element.closest("[hidden],[aria-hidden='true']") &&
      style.display !== "none" && style.visibility !== "hidden" &&
      style.visibility !== "collapse" && Number(style.opacity) !== 0 &&
      bounds.width > 0 && bounds.height > 0;
    const labelledBy = element.getAttribute("aria-labelledby");
    const labelledByText = labelledBy ? labelledBy.split(/\s+/)
      .map((id) => {
        const label = document.getElementById(id);
        return label ? sourceText.text(label, sourceText.isHidden(label)) : "";
      }).join(" ") : null;
    const explicitLabel = element.id ? labels.find((label) => label.htmlFor === element.id) : null;
    const wrappingLabel = element.closest("label");
    const labelElement = explicitLabel || wrappingLabel;
    const labelText = labelElement ?
      sourceText.text(labelElement, sourceText.isHidden(labelElement)) : null;
    const imageAlt = element.querySelector("img[alt]")?.getAttribute("alt") || null;
    const value = element instanceof HTMLInputElement &&
      ["button","image","reset","submit"].includes(inputType || "")
      ? element.value || element.alt : null;
    return { element, role, tagName, inputType,
      href: element instanceof HTMLAnchorElement ? element.getAttribute("href") : null,
      interactionEffect: element.getAttribute("data-interaction-effect"),
      ariaLabel: element.getAttribute("aria-label"), labelledByText, labelText,
      title: element.getAttribute("title"), imageAlt, value,
      text: sourceText.text(element), visible,
      disabled: element.matches(":disabled") || element.getAttribute("aria-disabled") === "true",
      inert: Boolean(element.closest("[inert]")),
      tabIndex: element.tabIndex,
      explicitTabIndex: element.hasAttribute("tabindex"),
      selected: element.getAttribute("aria-selected")?.toLowerCase() === "true",
      checked: element instanceof HTMLInputElement
        ? element.checked
        : element.getAttribute("aria-checked")?.toLowerCase() === "true" };
  }).filter((element) => element.visible &&
    (interactive.includes(element.role) || landmarks.includes(element.role)));
${KEYBOARD_FOCUS_POLICY_SCRIPT}
  })();
  return { elements, visibleText: sourceText.text(document.body) };
})()`;
