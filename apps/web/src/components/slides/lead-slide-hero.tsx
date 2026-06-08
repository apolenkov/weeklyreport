"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";
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

function metricTile(value: number, label: string, tooltip?: string) {
  return (
    <div
      className="inline-flex flex-col items-center gap-0.5 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.12)] bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
      title={tooltip ?? label}
    >
      <span className="text-base font-bold leading-none text-[var(--color-foreground)]">
        {value}
      </span>
      <span className="text-[10px] leading-none text-[var(--color-muted-foreground)]">
        {label}
      </span>
    </div>
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(0,0,0,0.08)] pb-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold",
              toneClassName,
            ].join(" ")}
          >
            {toneIcon}
            {toneLabel}
          </span>
          {heroControls}
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--color-muted-foreground)]">
          {displayName}
          {displayPeriod ? (
            <>
              <span aria-hidden="true"> · </span>
              {displayPeriod}
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {metricTile(slide.currentCount, "Current")}
        {metricTile(slide.riskCount, "Risks")}
        {metricTile(
          slide.priorityCount,
          "Priorities",
          "Priority items in this section",
        )}
        {metricTile(
          onTrackPct,
          "On-track %",
          "Percentage of products without blocked or at-risk status",
        )}
      </div>
    </div>
  );
}
