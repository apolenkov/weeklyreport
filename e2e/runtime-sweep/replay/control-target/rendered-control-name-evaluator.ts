import type { ElementHandle, Page } from "@playwright/test";

import { SOURCE_TEXT_HELPER_SCRIPT } from "../dom/dom-inventory.ts";

export interface RenderedNameEvaluationInput {
  readonly generation: string;
  readonly name: string;
  readonly roleName: string;
  readonly roleSelector: string;
  readonly validatorProperty: string;
}

declare global {
  interface Window {
    __customreportRenderedNameEvaluator?: (
      element: HTMLElement,
      expected: RenderedNameEvaluationInput,
    ) => boolean;
  }
}

export const EVALUATE_RENDERED_NAME_SCRIPT = String.raw`(element, expected) => {
  const sourceText = ${SOURCE_TEXT_HELPER_SCRIPT};
  const normalize = (value) => (value ?? "").replaceAll(/\s+/gu, " ").trim();
  const sourceTextFor = (target) =>
    sourceText.text(target, sourceText.isHidden(target));
  const renderedTextFor = (target) =>
    target instanceof HTMLElement && target.innerText
      ? target.innerText
      : target.textContent;
  const nameFor = (target, textFor) => {
    const labelledBy = target.getAttribute("aria-labelledby");
    if (labelledBy !== null)
      return normalize(labelledBy
        .split(/\s+/u)
        .map((id) => document.getElementById(id))
        .map((label) => label === null ? "" : textFor(label))
        .join(" "));
    const ariaLabel = target.getAttribute("aria-label");
    if (ariaLabel !== null) return normalize(ariaLabel);
    const explicitLabel = target.id
      ? [...document.querySelectorAll("label")].find(
          (label) => label.htmlFor === target.id,
        )
      : undefined;
    const labelElement = explicitLabel ?? target.closest("label");
    const labelText = labelElement === null || labelElement === undefined
      ? ""
      : textFor(labelElement);
    if (normalize(labelText) !== "") return normalize(labelText);
    const imageAlt = target.querySelector("img[alt]")?.getAttribute("alt") ?? null;
    const inputValue = target instanceof HTMLInputElement &&
      ["button", "image", "reset", "submit"].includes(target.type)
        ? target.value || target.alt
        : null;
    const namedValue = [target.getAttribute("title"), imageAlt, inputValue]
      .map((value) => normalize(value)).find((value) => value !== "");
    if (namedValue !== undefined) return namedValue;
    if (expected.roleName === "alertdialog") return "";
    return normalize(textFor(target));
  };
  const inventoryNameFor = (target) => nameFor(target, sourceTextFor);
  const renderedNameFor = (target) => nameFor(target, renderedTextFor);
  if (!(element instanceof HTMLElement)) return false;
  const matchesCurrent = () => {
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
      (inventoryNameFor(element) === expected.name ||
        renderedNameFor(element) === expected.name)
    );
  };
  if (!matchesCurrent()) return false;
  Object.assign(matchesCurrent, { generation: expected.generation });
  Object.defineProperty(element, expected.validatorProperty, {
    configurable: true,
    value: matchesCurrent,
  });
  return true;
}`;

export const INSTALL_RENDERED_NAME_EVALUATOR_SCRIPT = `(() => {
  window.__customreportRenderedNameEvaluator = ${EVALUATE_RENDERED_NAME_SCRIPT};
})()`;

export const REMOVE_RENDERED_NAME_EVALUATOR_SCRIPT =
  "delete window.__customreportRenderedNameEvaluator";

export const evaluateRenderedNameHandle = (
  page: Page,
  handle: ElementHandle<HTMLElement>,
  expected: RenderedNameEvaluationInput,
): Promise<boolean> =>
  page.evaluate<
    boolean,
    {
      readonly element: ElementHandle<HTMLElement>;
      readonly expected: RenderedNameEvaluationInput;
    }
  >(
    ({ element, expected: evaluationInput }) => {
      const evaluator = window.__customreportRenderedNameEvaluator;
      if (evaluator === undefined)
        throw new Error("Rendered-name evaluator is unavailable");
      return evaluator(element, evaluationInput);
    },
    { element: handle, expected },
  );
