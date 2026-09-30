import { type RefObject, useEffect } from "react";

import type { WeeklyProductReport } from "../../../report-sections";
import { SCROLL_INTO_VIEW_DELAY_MS } from "./accordion-tokens";

// Toggle is paired with the navigation that preceded it: manual collapse sticks
// through ordinary renders, while the next explicit jump force-opens the target.
export interface AccordionToggle {
  readonly navigationEpoch: number | undefined;
  readonly value: boolean;
}

export function resolveExpanded(
  toggle: AccordionToggle | null,
  {
    navigationEpoch,
    highlighted,
  }: {
    readonly navigationEpoch: number | undefined;
    readonly highlighted: boolean;
  },
  hasContent: boolean,
  defaultOpen: boolean,
): boolean {
  if (toggle !== null && toggle.navigationEpoch === navigationEpoch) {
    return toggle.value;
  }
  const explicitlyNavigated =
    navigationEpoch !== undefined && navigationEpoch > 0;
  return ((highlighted || explicitlyNavigated) && hasContent) || defaultOpen;
}

// Skip escalation when its text already appears as a row (derived from blocked
// item/risk; would duplicate inside Risks & Blockers). Distinct summaries still show.
export function shouldShowNeedsAttention(report: WeeklyProductReport): boolean {
  const attention = report.needsAttention;
  if (typeof attention !== "string" || attention.length === 0) {
    return false;
  }
  const renderedTexts = new Set([
    ...report.currentWeek.map((item) => item.text),
    ...report.nextWeek.map((item) => item.text),
    ...report.risks.map((risk) => risk.problem),
  ]);
  return !renderedTexts.has(attention);
}

export function useScrollIntoViewOnHighlight(
  rootRef: RefObject<HTMLElement | null>,
  highlighted: boolean,
  enabled: boolean,
  navigationEpoch: number | undefined,
): void {
  useEffect(() => {
    if (!highlighted || !enabled) return;
    const handle = window.setTimeout(() => {
      const prefersReducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior = prefersReducedMotion ? "auto" : "smooth";
      rootRef.current?.scrollIntoView({ behavior, block: "start" });
    }, SCROLL_INTO_VIEW_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [highlighted, enabled, navigationEpoch, rootRef]);
}
