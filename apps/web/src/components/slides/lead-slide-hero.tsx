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

/* Shared height for the hero status row's boxed elements (tone badge +
   segmented metric capsule). Lifting the literal to one const keeps both
   provably equal — the badge must never read taller than its siblings
   (polish-lead-toolbar 3.1). Keep the full `h-11` literal intact so
   Tailwind's JIT scanner still emits the class. */
const HERO_ROW_HEIGHT_CLASS = "h-11";

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
        // Blocked = the canonical status tokens (matches item-card + the slide
        // deck): blocked-bg fill, destructive text/icon, faint destructive border.
        className:
          "border-[color-mix(in_srgb,var(--color-destructive)_24%,transparent)] bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]",
        icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      };
    case "at-risk":
      return {
        label: "At risk",
        // At-risk = amber tokens; amber is the at-risk accent only (one alarm hue).
        className:
          "border-[color-mix(in_srgb,var(--color-status-dot-at-risk)_38%,transparent)] bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]",
        icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
      };
    case "on-track":
      return {
        label: "On track",
        className:
          "border-[color-mix(in_srgb,var(--color-starbucks-accent)_28%,transparent)] bg-[var(--color-success)] text-[var(--color-primary)]",
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
   hairline dividers, each segment icon + value + label on one line.
   Exported: the head slide header reuses the segment to render its portfolio
   metrics in the same capsule treatment (redesign-head-slide-density 1.1 #5). */
export function metricSegment(
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
       toggle is the only thing on the right.
       Fullscreen: the floating "Exit" pill is fixed at the viewport top-right
       (slide-fullscreen-button), so reserve right space ONLY in fullscreen to
       push the right-hand controls (scope toggle) clear of it — otherwise the
       pill overlaps the toggle. */
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[rgba(0,0,0,0.08)] pb-4 [:fullscreen_&]:pr-28">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {/* Fixed badge and name widths keep the capsule at one X across
            slides/periods (feedback round 4: no floating layout). */}
        <span
          className={[
            `inline-flex ${HERO_ROW_HEIGHT_CLASS} w-[112px] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border px-3 text-xs font-semibold`,
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
        <div
          className={`inline-flex ${HERO_ROW_HEIGHT_CLASS} items-center divide-x divide-[rgba(0,0,0,0.08)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.12)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]`}
        >
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
