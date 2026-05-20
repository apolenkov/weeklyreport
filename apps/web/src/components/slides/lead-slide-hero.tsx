"use client";

import { AlertTriangle, Check, Circle } from "lucide-react";

import type { SectionSlideModel } from "./section-slide-utils";

type ToneVariant = "blocked" | "at-risk" | "on-track" | "empty";

function worstProductTone(
  products: SectionSlideModel["productSlides"],
): ToneVariant {
  if (products.length === 0) return "empty";
  const statuses = products
    .filter((p) => p.id !== "cross-product")
    .map((p) => p.status);
  if (statuses.some((s) => s === "red")) return "blocked";
  if (statuses.some((s) => s === "yellow")) return "at-risk";
  if (statuses.every((s) => s === "green" || s === null)) {
    if (statuses.some((s) => s === "green")) return "on-track";
  }
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
        className:
          "border-[rgba(200,32,20,0.24)] bg-[#fee2e2] text-[#7f1d1d]",
        icon: (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        ),
      };
    case "at-risk":
      return {
        label: "At risk",
        // amber-100 bg + amber-900 text → WCAG AA pass for small text
        className:
          "border-[rgba(212,160,23,0.38)] bg-[#fef3c7] text-[#78350f]",
        icon: (
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        ),
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

function metricTile(value: number, label: string) {
  return (
    <div className="rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-white/80 px-3 py-2">
      <div className="text-lg font-semibold text-[var(--color-primary)]">
        {value}
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
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

type Props = {
  readonly slide: SectionSlideModel;
  readonly authorName?: string;
  readonly periodLabel?: string;
};

export function LeadSlideHero({ slide, authorName, periodLabel }: Props) {
  const tone = worstProductTone(slide.productSlides);
  const { label: toneLabel, className: toneClassName, icon: toneIcon } =
    toneConfig(tone);
  const onTrackPct = computeOnTrackPct(slide.productSlides);
  const displayName = authorName ?? slide.ownerName;
  const displayPeriod = periodLabel ?? slide.ownerRole;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(0,0,0,0.08)] pb-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-xs font-semibold",
              toneClassName,
            ].join(" ")}
          >
            {toneIcon}
            {toneLabel}
          </span>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metricTile(slide.currentCount, "Current")}
        {metricTile(slide.riskCount, "Risks")}
        {metricTile(slide.priorityCount, "Priorities")}
        {metricTile(onTrackPct, "On-track %")}
      </div>
    </div>
  );
}
