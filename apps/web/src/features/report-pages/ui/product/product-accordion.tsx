"use client";

import { useRef, useState } from "react";

import {
  reportHasContent,
  type WeeklyProductReport,
} from "../../../report-sections";
import type { AccordionReviewContext } from "../../../review";
import { AccordionHeader } from "./accordion-header";
import { AccordionSections } from "./accordion-sections";
import {
  type AccordionToggle,
  resolveExpanded,
  shouldShowNeedsAttention,
  useScrollIntoViewOnHighlight,
} from "./product-accordion-state";

interface ProductAccordionProps {
  readonly report: WeeklyProductReport;
  readonly defaultOpen?: boolean | undefined;
  readonly highlighted?: boolean | undefined;
  readonly scrollIntoViewOnHighlight?: boolean | undefined;
  readonly navigationEpoch?: number | undefined;
  readonly instanceRootId?: string | undefined;
  readonly review?: AccordionReviewContext | undefined;
}

// Empty cards use a quiet tint; an active highlight gets the accent ring.
// This helper keeps the render body focused on state wiring.
function surfaceProps(hasContent: boolean, isHighlightActive: boolean) {
  return {
    className: `card-surface-elevated scroll-mt-28 overflow-hidden rounded-[var(--radius)] border transition-[border-color,box-shadow] motion-reduce:transition-none ${
      hasContent ? "card-surface-fill" : "bg-[var(--color-surface-empty-tint)]"
    }`,
    style: {
      borderColor: isHighlightActive
        ? "var(--color-starbucks-accent)"
        : "var(--card-surface-border)",
      boxShadow: isHighlightActive
        ? "0 0 0 2px var(--color-highlight-shadow), 0 8px 18px -14px var(--color-border-strong)"
        : undefined,
    },
  };
}

// Keep the collapsed panel mounted while height animates through a 0fr→1fr grid
// row; only visibility and interaction state change while hidden.
function ExpandingSections({
  report,
  review,
  showNeedsAttention,
  expanded,
  panelId,
  toggleId,
}: {
  readonly report: WeeklyProductReport;
  readonly review: AccordionReviewContext | undefined;
  readonly showNeedsAttention: boolean;
  readonly expanded: boolean;
  readonly panelId: string;
  readonly toggleId: string;
}) {
  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={toggleId}
      className="grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div
        className="min-h-0 overflow-hidden"
        inert={expanded ? undefined : true}
        aria-hidden={!expanded}
      >
        <AccordionSections
          report={report}
          review={review}
          showNeedsAttention={showNeedsAttention}
        />
      </div>
    </div>
  );
}

export function ProductAccordion({
  report,
  defaultOpen = false,
  highlighted = false,
  scrollIntoViewOnHighlight = false,
  navigationEpoch,
  instanceRootId,
  review,
}: ProductAccordionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [toggle, setToggle] = useState<AccordionToggle | null>(null);
  const hasContent = reportHasContent(report);
  const expanded = resolveExpanded(
    toggle,
    navigationEpoch,
    highlighted,
    hasContent,
    defaultOpen,
  );
  const setExpanded = (value: boolean) => setToggle({ navigationEpoch, value });
  const showNeedsAttention = shouldShowNeedsAttention(report);
  const isHighlightActive = highlighted && hasContent;
  const rootId = instanceRootId ?? `report-product-${report.id}`;
  const toggleId = `${rootId}-toggle`;
  const panelId = `${rootId}-panel`;

  useScrollIntoViewOnHighlight(
    rootRef,
    highlighted,
    scrollIntoViewOnHighlight,
    navigationEpoch,
  );

  return (
    <div
      ref={rootRef}
      id={rootId}
      data-feedback-anchor={rootId}
      {...surfaceProps(hasContent, isHighlightActive)}
    >
      <AccordionHeader
        report={report}
        hasContent={hasContent}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        toggleId={toggleId}
        panelId={panelId}
      />

      {hasContent ? (
        <ExpandingSections
          report={report}
          review={review}
          showNeedsAttention={showNeedsAttention}
          expanded={expanded}
          panelId={panelId}
          toggleId={toggleId}
        />
      ) : null}
    </div>
  );
}
