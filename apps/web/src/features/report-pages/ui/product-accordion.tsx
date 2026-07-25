"use client";

import { useState } from "react";

import {
  reportHasContent,
  type WeeklyProductReport,
} from "../../report-sections";
import { AccordionHeader } from "./accordion-header";
import { AccordionSections } from "./accordion-sections";
import {
  type AccordionToggle,
  resolveExpanded,
  shouldShowNeedsAttention,
  useScrollIntoViewOnHighlight,
} from "./product-accordion-state";
import type { AccordionReviewContext } from "./reviewed-row";

export type { AccordionReviewContext } from "./reviewed-row";

interface ProductAccordionProps {
  readonly report: WeeklyProductReport;
  readonly defaultOpen?: boolean;
  readonly highlighted?: boolean;
  readonly scrollIntoViewOnHighlight?: boolean;
  readonly review?: AccordionReviewContext;
}

// Empty cards render dimmed; an active highlight gets the accent ring. Kept
// outside the component so the render body stays within the function budget.
function surfaceProps(hasContent: boolean, isHighlightActive: boolean) {
  return {
    className: `card-surface-elevated scroll-mt-28 overflow-hidden rounded-[var(--radius)] border transition-[border-color,box-shadow] ${
      hasContent ? "card-surface-fill" : "bg-[rgba(0,0,0,0.035)] opacity-90"
    }`,
    style: {
      borderColor: isHighlightActive
        ? "var(--color-starbucks-accent)"
        : "rgba(0,0,0,0.10)",
      boxShadow: isHighlightActive
        ? "0 0 0 2px var(--color-highlight-shadow), 0 8px 18px -14px rgba(0,0,0,0.18)"
        : undefined,
    },
  };
}

/**
 * Product Accordion.
 * @param props - The props argument.
 */
export function ProductAccordion({
  report,
  defaultOpen = false,
  highlighted = false,
  scrollIntoViewOnHighlight = false,
  review,
}: ProductAccordionProps) {
  const [toggle, setToggle] = useState<AccordionToggle | null>(null);
  const hasContent = reportHasContent(report);
  const expanded = resolveExpanded(
    toggle,
    highlighted,
    hasContent,
    defaultOpen,
  );
  const setExpanded = (value: boolean) => setToggle({ highlighted, value });
  const showNeedsAttention = shouldShowNeedsAttention(report);
  const isHighlightActive = highlighted && hasContent;

  useScrollIntoViewOnHighlight(
    report.id,
    highlighted,
    scrollIntoViewOnHighlight,
  );

  return (
    <div
      id={`report-product-${report.id}`}
      {...surfaceProps(hasContent, isHighlightActive)}
    >
      <AccordionHeader
        report={report}
        hasContent={hasContent}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />

      {hasContent ? (
        <div
          className="grid transition-[grid-template-rows] duration-300"
          style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden">
            <AccordionSections
              report={report}
              review={review}
              showNeedsAttention={showNeedsAttention}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
