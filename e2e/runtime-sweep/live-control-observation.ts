import type { Page } from "@playwright/test";

import type { LiveControlObservation } from "./live-control-planning.ts";

const MEANINGFUL_SCROLL_DELTA_PX = 8;

export interface PageSnapshot {
  readonly url: string;
  readonly dom: string;
  readonly focus: string;
  readonly network: number;
  readonly focusTarget?: string;
  readonly scrollX?: number;
  readonly scrollY?: number;
}

export const snapshotPage = async (page: Page): Promise<PageSnapshot> =>
  page.evaluate(() => {
    const active = document.activeElement ?? document.body;
    const controls = Array.from(
      document.querySelectorAll(
        "a[href],button,input,select,textarea,[role],[contenteditable='true']",
      ),
    ).map((element) => ({
      role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
      name: element.getAttribute("aria-label") ?? element.textContent.trim(),
      checked:
        element instanceof HTMLInputElement ? element.checked : undefined,
      ariaChecked: element.getAttribute("aria-checked"),
      selected: element.getAttribute("aria-selected"),
      value:
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
          ? element.value
          : undefined,
    }));
    const activeText = active.textContent.trim();
    return {
      url: location.href,
      dom: JSON.stringify({ text: document.body.innerText, controls }),
      focus: `${active.tagName}:${active.getAttribute("role") ?? ""}:${active.getAttribute("aria-label") ?? activeText}`,
      focusTarget: `${active.tagName.toLocaleLowerCase()}#${active.getAttribute("id") ?? ""}:${active.getAttribute("role") ?? ""}`,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      network: performance.getEntriesByType("resource").length,
    };
  });

const meaningfulFocusTarget = (target: string | undefined): boolean => {
  if (target === undefined) return false;
  const normalized = target.toLocaleLowerCase();
  return (
    normalized.includes("#main-content") ||
    normalized.startsWith("main#") ||
    normalized.includes(":main") ||
    normalized.includes(":article") ||
    normalized.includes(":region")
  );
};

const meaningfulFocusChanged = (
  before: PageSnapshot,
  after: PageSnapshot,
): boolean =>
  (before.focus !== after.focus || before.focusTarget !== after.focusTarget) &&
  meaningfulFocusTarget(after.focusTarget);

const meaningfulScrollChanged = (
  before: PageSnapshot,
  after: PageSnapshot,
): boolean => {
  const deltaX = Math.abs((after.scrollX ?? 0) - (before.scrollX ?? 0));
  const deltaY = Math.abs((after.scrollY ?? 0) - (before.scrollY ?? 0));
  return (
    deltaX >= MEANINGFUL_SCROLL_DELTA_PX || deltaY >= MEANINGFUL_SCROLL_DELTA_PX
  );
};

export const observationFor = (
  before: PageSnapshot,
  after: PageSnapshot,
): LiveControlObservation | undefined => {
  if (before.url !== after.url)
    return { kind: "url", detail: `URL changed to ${after.url}` };
  if (before.dom !== after.dom)
    return { kind: "dom", detail: "Live DOM or control state changed" };
  if (before.network !== after.network)
    return {
      kind: "network",
      detail: `${after.network - before.network} resource request(s) observed`,
    };
  if (meaningfulFocusChanged(before, after))
    return {
      kind: "focus",
      detail: "Focus moved to page content after the action",
    };
  if (meaningfulScrollChanged(before, after))
    return {
      kind: "focus",
      detail: "Page content scroll position changed after the action",
    };
  return undefined;
};
