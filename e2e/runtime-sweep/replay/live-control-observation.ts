import type { Page } from "@playwright/test";

import type { LiveControlObservation } from "./live-control-planning.ts";

interface PageControlSnapshot {
  readonly role: string;
  readonly name: string;
  readonly title: string | null;
  readonly checked: boolean | undefined;
  readonly ariaChecked: string | null;
  readonly ariaExpanded: string | null;
  readonly ariaPressed: string | null;
  readonly selected: string | null;
  readonly value: string | undefined;
}

export interface PageSnapshot {
  readonly url: string;
  readonly dom: string;
  readonly focus: string;
  readonly network: number;
  readonly focusTarget?: string;
  readonly scrollX?: number;
  readonly scrollY?: number;
  readonly controls?: readonly PageControlSnapshot[];
}

export interface ObservationPolicy {
  readonly requireMeaningfulFocus?: boolean;
}

interface ObservableControlTarget {
  readonly controlKey: string;
  readonly ariaRole: string;
  readonly accessibleName: string;
}

const IDENTITY_ACTIVE_ROLES: ReadonlySet<string> = new Set([
  "radio",
  "menuitemradio",
  "tab",
]);

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
      title: element.getAttribute("title"),
      checked:
        element instanceof HTMLInputElement ? element.checked : undefined,
      ariaChecked: element.getAttribute("aria-checked"),
      ariaExpanded: element.getAttribute("aria-expanded"),
      ariaPressed: element.getAttribute("aria-pressed"),
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
      controls,
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

const occurrenceFrom = (controlKey: string): number => {
  const match = /:(\d+)$/u.exec(controlKey);
  const occurrence = Number(match?.[1] ?? "1");
  return Number.isInteger(occurrence) && occurrence > 0 ? occurrence : 1;
};

const normalized = (value: string): string =>
  value.replaceAll(/\s+/gu, " ").trim();

const matchingControlCount = (
  snapshot: PageSnapshot,
  target: ObservableControlTarget,
): number =>
  (snapshot.controls ?? []).filter(
    (control) =>
      control.role === target.ariaRole &&
      [control.name, control.title ?? ""].some(
        (name) => normalized(name) === normalized(target.accessibleName),
      ),
  ).length;

export const controlCountDecreased = (
  before: PageSnapshot,
  after: PageSnapshot,
  target: ObservableControlTarget,
): boolean =>
  matchingControlCount(after, target) < matchingControlCount(before, target);

export const controlAlreadyActive = (
  before: PageSnapshot,
  target: ObservableControlTarget,
): boolean => {
  const controls = before.controls ?? [];
  const matching = controls.filter(
    (control) =>
      control.role === target.ariaRole &&
      [control.name, control.title ?? ""].some(
        (name) => normalized(name) === normalized(target.accessibleName),
      ),
  );
  const control = matching[occurrenceFrom(target.controlKey) - 1];
  return (
    control?.ariaPressed === "true" ||
    control?.selected === "true" ||
    (IDENTITY_ACTIVE_ROLES.has(target.ariaRole) &&
      (control?.checked === true || control?.ariaChecked === "true"))
  );
};

export const observationFor = (
  before: PageSnapshot,
  after: PageSnapshot,
  policy: ObservationPolicy = {},
): LiveControlObservation | undefined => {
  if (policy.requireMeaningfulFocus === true)
    return meaningfulFocusChanged(before, after)
      ? {
          kind: "focus",
          detail: "Focus moved to page content after the action",
        }
      : undefined;
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
  return undefined;
};

export const waitForObservation = async (
  page: Page,
  before: PageSnapshot,
  timeoutMs: number,
  policy: ObservationPolicy = {},
): Promise<LiveControlObservation | undefined> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          }),
      );
      const observed = observationFor(before, await snapshotPage(page), policy);
      if (observed !== undefined) return observed;
    } catch (error: unknown) {
      if (!(
        error instanceof Error &&
        /Execution context was destroyed.*navigation/iu.test(error.message)
      ))
        throw error;
    }
  }
  return undefined;
};
