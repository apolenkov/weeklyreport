"use client";

import {
  AlertTriangle,
  Check,
  Circle,
  Gauge,
  Star,
  Target,
} from "lucide-react";
import type { ReactNode } from "react";

import type { SectionSlideModel } from "./section-slide-utils";

type ToneVariant = "blocked" | "at-risk" | "on-track" | "empty";

function worstProductTone(
  products: SectionSlideModel["productSlides"],
): ToneVariant {
  if (products.length === 0) return "empty";
  const statuses = products
    .filter((p) => p.id !== "cross-product")
    .map((p) => p.status);
  if (statuses.includes("red")) return "blocked";
  if (statuses.includes("yellow")) return "at-risk";
  if (
    statuses.every((s) => s === "green" || s === null) &&
    statuses.includes("green")
  )
    return "on-track";
  return "empty";
}

function toneConfig(tone: ToneVariant): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (tone) {
    case "blocked":
      return {
        label: "Blockers",
        // red-100 bg + red-950 text → WCAG AA pass for small text
        className: "border-[rgba(200,32,20,0.24)] bg-[#fee2e2] text-[#7f1d1d]",
        icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      };
    case "at-risk":
      return {
        label: "At risk",
        // amber-100 bg + amber-900 text → WCAG AA pass for small text
        className: "border-[rgba(212,160,23,0.38)] bg-[#fef3c7] text-[#78350f]",
        icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      };
    case "on-track":
      return {
        label: "On track",
        className:
          "border-[rgba(0,117,74,0.28)] bg-[rgba(229,245,237,0.74)] text-[var(--color-primary)]",
        icon: <Check className="h-3.5 w-3.5" aria-hidden="true" />,
      };
    case "empty":
      return {
        label: "No status",
        className:
          "border-[rgba(0,0,0,0.14)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
        icon: <Circle className="h-3 w-3" aria-hidden="true" />,
      };
  }
}

/* Feedback round 2 (2026-06-10, frontend-design pass): the four metrics read
   as ONE segmented capsule — a single pill at the shared row height, split by
   hairline dividers, each segment icon + value + label on one line. */
function metricSegment(
  value: number,
  label: string,
  icon: ReactNode,
  tooltip?: string,
) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3"
      title={tooltip ?? label}
    >
      <span aria-hidden="true" className="text-[var(--color-muted-foreground)]">
        {icon}
      </span>
      {/* Fixed value width + tabular digits: switching slides/periods must
          not shift the capsule layout (feedback round 4). */}
      <span className="min-w-[3ch] text-center text-sm font-bold leading-none tabular-nums text-[var(--color-foreground)]">
        {value}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-[0.06em] leading-none text-[var(--color-muted-foreground)]">
        {label}
      </span>
    </span>
  );
}

function computeOnTrackPct(
  products: SectionSlideModel["productSlides"],
): number {
  const real = products.filter((p) => p.id !== "cross-product");
  if (real.length === 0) return 100;
  const green = real.filter((p) => p.status === "green").length;
  return Math.round((green / real.length) * 100);
}

interface Props {
  readonly slide: SectionSlideModel;
  readonly authorName?: string;
  readonly periodLabel?: string;
  /** Rendered inline with the tone badge, e.g. scope toggle + agent review. */
  readonly heroControls?: ReactNode;
}

export function LeadSlideHero({
  slide,
  authorName,
  periodLabel,
  heroControls,
}: Props) {
  const tone = worstProductTone(slide.productSlides);
  const {
    label: toneLabel,
    className: toneClassName,
    icon: toneIcon,
  } = toneConfig(tone);
  const onTrackPct = computeOnTrackPct(slide.productSlides);
  const displayName = authorName ?? slide.ownerName;
  const displayPeriod = periodLabel ?? slide.ownerRole;

  return (
    /* Feedback round 2 (2026-06-10, frontend-design pass): one status strip.
       Everything static sits LEFT on a single line at one height (h-11):
       tone badge → author → segmented metric capsule. The interactive scope
       toggle is the only thing on the right. */
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[rgba(0,0,0,0.08)] pb-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {/* Fixed badge and name widths keep the capsule at one X across
            slides/periods (feedback round 4: no floating layout). */}
        <span
          className={[
            "inline-flex h-11 w-[112px] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border px-3 text-xs font-semibold",
            toneClassName,
          ].join(" ")}
        >
          {toneIcon}
          {toneLabel}
        </span>
        <p className="min-w-[150px] truncate text-sm font-medium text-[var(--color-muted-foreground)]">
          {displayName}
          {displayPeriod ? (
            <>
              <span aria-hidden="true"> · </span>
              {displayPeriod}
            </>
          ) : null}
        </p>
        <div className="inline-flex h-11 items-center divide-x divide-[rgba(0,0,0,0.08)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.12)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          {metricSegment(
            slide.currentCount,
            "Current",
            <Target className="h-4 w-4" />,
          )}
          {metricSegment(
            slide.riskCount,
            "Risks",
            <AlertTriangle className="h-4 w-4" />,
          )}
          {metricSegment(
            slide.priorityCount,
            "Priorities",
            <Star className="h-4 w-4" />,
            "Priority items in this section",
          )}
          {metricSegment(
            onTrackPct,
            "On-track",
            <Gauge className="h-4 w-4" />,
            "Percentage of products without blocked or at-risk status",
          )}
        </div>
      </div>
      {heroControls}
    </div>
  );
}
