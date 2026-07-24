import { useEffect } from "react";

import type { WeeklyProductReport } from "../../report-sections";
import { SCROLL_INTO_VIEW_DELAY_MS } from "./accordion-tokens";

// A manual toggle is stored PAIRED with the highlight state it was made under:
// a fresh highlight (search jump) invalidates the stored value, so the card
// force-opens; a collapse made WHILE highlighted sticks until the highlight
// changes — the old force-open effect's semantics, derived.
export interface AccordionToggle {
  readonly highlighted: boolean;
  readonly value: boolean;
}

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

// Suppress the escalation when its text is verbatim a row already rendered in
// this card. The escalation is DERIVED from a blocked item or risk, so it would
// otherwise repeat that row — and since it folds INTO Risks & Blockers, a
// matching risk would sit immediately above its duplicate. A genuinely distinct
// head-facing summary (no exact item/risk match) still surfaces as a leading
// Flagged row.
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
