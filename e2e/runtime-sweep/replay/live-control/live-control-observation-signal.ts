import { errors, type Page } from "@playwright/test";

import type { PageSnapshot } from "./live-control-observation.ts";

export interface ObservationBaseline {
  readonly documentId?: string;
  readonly url: string;
  readonly dom: string;
  readonly focus: string;
  readonly focusTarget?: string;
  readonly network: number;
}

export const waitForObservationSignal = async (
  page: Page,
  baseline: ObservationBaseline,
  timeoutMs: number,
): Promise<true | undefined> => {
  try {
    const handle = await page.waitForFunction(
      (previous) => {
        const active = document.activeElement ?? document.body;
        const controls = Array.from(
          document.querySelectorAll(
            "a[href],button,input,select,textarea,[role],[contenteditable='true']",
          ),
        ).map((element) => {
          const controlled = document.getElementById(
            element.getAttribute("aria-controls") ?? "",
          );
          return {
            role: element.getAttribute("role") ?? element.tagName.toLowerCase(),
            name:
              element.getAttribute("aria-label") ?? element.textContent.trim(),
            title: element.getAttribute("title"),
            checked:
              element instanceof HTMLInputElement ? element.checked : undefined,
            ariaChecked: element.getAttribute("aria-checked"),
            ariaCurrent: element.getAttribute("aria-current"),
            ariaExpanded: element.getAttribute("aria-expanded"),
            ariaPressed: element.getAttribute("aria-pressed"),
            controlledExpanded:
              controlled === null
                ? undefined
                : controlled.getAttribute("aria-expanded") === "true" ||
                  controlled.querySelector('[aria-expanded="true"]') !== null,
            selected: element.getAttribute("aria-selected"),
            value:
              element instanceof HTMLInputElement ||
              element instanceof HTMLSelectElement
                ? element.value
                : undefined,
          };
        });
        const documentId = String(performance.timeOrigin);
        const url = location.href;
        const dom = JSON.stringify({ text: document.body.innerText, controls });
        const focus = `${active.tagName}:${active.getAttribute("role") ?? ""}:${active.getAttribute("aria-label") ?? active.textContent.trim()}`;
        const focusTarget = `${active.tagName.toLowerCase()}#${active.id}:${active.getAttribute("role") ?? ""}`;
        const network = performance.getEntriesByType("resource").length;
        return (
          url !== previous.url ||
          dom !== previous.dom ||
          (documentId === previous.documentId && network > previous.network) ||
          focus !== previous.focus ||
          (previous.focusTarget !== undefined &&
            focusTarget !== previous.focusTarget) ||
          (previous.documentId !== undefined &&
            documentId !== previous.documentId)
        );
      },
      baseline,
      { polling: "raf", timeout: timeoutMs },
    );
    await handle.dispose();
    return true;
  } catch (error: unknown) {
    if (error instanceof errors.TimeoutError) return undefined;
    throw error;
  }
};

export const observationBaselineFor = (
  snapshot: PageSnapshot,
): ObservationBaseline => snapshot;
