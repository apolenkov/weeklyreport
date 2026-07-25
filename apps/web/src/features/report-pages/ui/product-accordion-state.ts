import { useEffect } from "react";

import type { WeeklyProductReport } from "../../report-sections";
import { SCROLL_INTO_VIEW_DELAY_MS } from "./accordion-tokens";

// Toggle is paired with the highlight it was made under: a new search-jump
// highlight invalidates it (force-open); collapse while highlighted sticks.
export interface AccordionToggle {
  readonly highlighted: boolean;
  readonly value: boolean;
}

/**
 * Resolve Expanded.
 * @param toggle - The toggle argument.
 * @param highlighted - The highlighted argument.
 * @param hasContent - The hasContent argument.
 * @param defaultOpen - The defaultOpen argument.
 */
export function resolveExpanded(
  toggle: AccordionToggle | null,
  highlighted: boolean,
  hasContent: boolean,
  defaultOpen: boolean,
): boolean {
  if (toggle !== null && toggle.highlighted === highlighted) {
    return toggle.value;
  }
  return (highlighted && hasContent) || defaultOpen;
}

// Skip escalation when its text already appears as a row (derived from blocked
// item/risk; would duplicate inside Risks & Blockers). Distinct summaries still show.
/**
 * Should Show Needs Attention.
 * @param report - The report argument.
 */
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

/**
 * Use Scroll Into View On Highlight.
 * @param reportId - The reportId argument.
 * @param highlighted - The highlighted argument.
 * @param enabled - The enabled argument.
 */
export function useScrollIntoViewOnHighlight(
  reportId: string,
  highlighted: boolean,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!highlighted || !enabled) return;
    const handle = window.setTimeout(() => {
      document
        .getElementById(`report-product-${reportId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, SCROLL_INTO_VIEW_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [highlighted, reportId, enabled]);
}
