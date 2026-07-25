"use client";

import { Gauge } from "lucide-react";

import type { SectionSlideModel } from "../model/section-slide-contracts";

// Cards omit status: Blocked/Review/Ready must render exactly once, on the
// active slide header only.
/**
 * Head Slide Carousel.
 * @param options - The options argument.
 */
export function HeadSlideCarousel({
  slides,
  selectedIndex,
  onSelect,
}: {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  return (
    <div
      data-testid="head-slide-carousel"
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Slides"
    >
      {slides.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={`${item.id}:${item.pageIndex ?? 0}`}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={selected ? "true" : undefined}
            className={[
              "flex w-[180px] shrink-0 flex-col gap-1 rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors",
              selected
                ? "border-[var(--color-starbucks-accent)] bg-[var(--color-card)] shadow-[0_0_0_2px_rgba(0,117,74,0.13)]"
                : "border-[rgba(0,0,0,0.10)] bg-[var(--color-card)] hover:border-[var(--color-border)]",
            ].join(" ")}
          >
            <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">
              {item.ownerName}
            </span>
            <span className="truncate text-xs text-[var(--color-muted-foreground)]">
              {item.pageLabel ??
                (item.products.length > 0
                  ? item.products.join(" / ")
                  : "No product scope")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              {item.score}% ready
            </span>
          </button>
        );
      })}
    </div>
  );
}
