"use client";

import { ArrowLeft, ArrowRight, Gauge } from "lucide-react";
import { type Ref, useEffect, useRef } from "react";

import type { SectionSlideModel } from "../model/section-slide-contracts";

const CAROUSEL_BUTTON_CLASSNAME =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-35";

type CarouselDirection = "previous" | "next";

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  readonly direction: CarouselDirection;
  readonly disabled: boolean;
  readonly onClick: () => void;
}) {
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${direction === "previous" ? "Previous" : "Next"} slide`}
      className={CAROUSEL_BUTTON_CLASSNAME}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function SlideCard({
  item,
  index,
  selected,
  selectedCardRef,
  onSelect,
}: {
  readonly item: SectionSlideModel;
  readonly index: number;
  readonly selected: boolean;
  readonly selectedCardRef: Ref<HTMLButtonElement>;
  readonly onSelect: (index: number) => void;
}) {
  return (
    <button
      ref={selected ? selectedCardRef : undefined}
      type="button"
      onClick={() => onSelect(index)}
      aria-current={selected ? "true" : undefined}
      data-testid={`head-slide-card-${index}`}
      className={[
        "flex w-[180px] shrink-0 snap-start flex-col gap-1 rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-[var(--color-starbucks-accent)] bg-[var(--color-card)] shadow-[var(--shadow-slide-card-selected)]"
          : "border-[var(--card-surface-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]",
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
}

function keepSelectedCardVisible(
  viewport: HTMLDivElement,
  selectedCard: HTMLButtonElement,
): void {
  const viewportRect = viewport.getBoundingClientRect();
  const selectedCardRect = selectedCard.getBoundingClientRect();
  const currentScrollLeft = viewport.scrollLeft;
  const targetScrollLeft =
    selectedCardRect.left < viewportRect.left
      ? currentScrollLeft + selectedCardRect.left - viewportRect.left
      : selectedCardRect.right > viewportRect.right
        ? currentScrollLeft + selectedCardRect.right - viewportRect.right
        : currentScrollLeft;
  if (targetScrollLeft === currentScrollLeft) return;

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  viewport.scrollTo({
    left: Math.max(targetScrollLeft, 0),
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });
}

// Cards omit status: Blocked/Review/Ready must render exactly once, on the
// active slide header only.
export function HeadSlideCarousel({
  slides,
  selectedIndex,
  onSelect,
}: {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const selectedCardRef = useRef<HTMLButtonElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const selectedCard = selectedCardRef.current;
    if (!viewport || !selectedCard) return;
    keepSelectedCardVisible(viewport, selectedCard);
  }, [selectedIndex]);

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      data-testid="head-slide-carousel"
      role="group"
      aria-label="Slides"
    >
      <CarouselArrow
        direction="previous"
        onClick={() => onSelect(Math.max(selectedIndex - 1, 0))}
        disabled={slides.length === 0 || selectedIndex <= 0}
      />

      <div
        ref={viewportRef}
        className="min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto pb-1 motion-safe:scroll-smooth"
        data-testid="head-slide-carousel-viewport"
      >
        <div className="flex gap-2">
          {slides.map((item, index) => (
            <SlideCard
              key={`${item.id}:${item.pageIndex ?? 0}`}
              item={item}
              index={index}
              selected={index === selectedIndex}
              selectedCardRef={selectedCardRef}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>

      <CarouselArrow
        direction="next"
        onClick={() =>
          onSelect(Math.min(selectedIndex + 1, Math.max(slides.length - 1, 0)))
        }
        disabled={slides.length === 0 || selectedIndex >= slides.length - 1}
      />
    </div>
  );
}
