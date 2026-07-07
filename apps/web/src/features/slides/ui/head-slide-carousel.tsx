"use client";

import { Gauge } from "lucide-react";

import type { SectionSlideModel } from "../model/section-slide-utils";

/**
 * head-slides-carousel-fullscreen: the head deck's slide navigation — a
 * horizontal carousel of slide cards above the active slide, replacing the
 * former left sidebar list. Selecting a card activates that slide; arrow-key
 * navigation is owned by the parent deck section.
 *
 * Cards deliberately carry NO status badge or status text: the slide status
 * (Blocked / Review / Ready) renders exactly once, on the active slide header
 * (the "status renders exactly once per slide" requirement). The old sidebar
 * card duplicated it both here and in the focus slide.
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
            key={item.id}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={selected ? "true" : undefined}
            className={[
              "flex w-[180px] shrink-0 flex-col gap-1 rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors",
              selected
                ? "border-[var(--color-starbucks-accent)] bg-white shadow-[0_0_0_2px_rgba(0,117,74,0.13)]"
                : "border-[rgba(0,0,0,0.10)] bg-white hover:border-[var(--color-border)]",
            ].join(" ")}
          >
            <span className="truncate text-sm font-semibold text-[var(--color-foreground)]">
              {item.ownerName}
            </span>
            <span className="truncate text-xs text-[var(--color-muted-foreground)]">
              {item.products.length > 0
                ? item.products.join(" / ")
                : "No product scope"}
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
