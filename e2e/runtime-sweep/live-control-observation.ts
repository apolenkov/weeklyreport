import type { Page } from "@playwright/test";

import type { LiveControlObservation } from "./live-control-planning.ts";

export interface PageSnapshot {
  readonly url: string;
  readonly dom: string;
  readonly focus: string;
  readonly network: number;
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
      network: performance.getEntriesByType("resource").length,
    };
  });

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
  return undefined;
};
