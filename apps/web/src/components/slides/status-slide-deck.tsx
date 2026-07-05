"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, useRef } from "react";

import { useFullscreen } from "../../hooks/use-fullscreen";
import { DeckFullscreenOverlay } from "./deck-fullscreen-overlay";
import { HeadSlideCarousel } from "./head-slide-carousel";
import type { SectionSlideModel } from "./section-slide-utils";
import { SlideArticle } from "./slide-article";

interface StatusSlideDeckProps {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly mode: "lead" | "head";
  readonly toolbar?: ReactNode;
  readonly heroControls?: ReactNode;
}

function selectedSlide(
  slides: readonly SectionSlideModel[],
  index: number,
): SectionSlideModel | undefined {
  return index >= 0 && index < slides.length ? slides[index] : undefined;
}

/** The head deck owns its fullscreen affordance (the lead deck's lives in
 * LeadSlidesClient); the frame also provides the horizontal scroll floor for
 * the article's min canvas width. */
function HeadSlideFrame({ slide }: { readonly slide: SectionSlideModel }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(frameRef, frameRef);
  return (
    <div
      ref={frameRef}
      tabIndex={-1}
      className="relative overflow-auto bg-[var(--color-background)]"
    >
      <DeckFullscreenOverlay
        isFullscreen={fullscreen.isFullscreen}
        onToggle={fullscreen.toggle}
      />
      <SlideArticle slide={slide} />
    </div>
  );
}

export function StatusSlideDeck({
  slides,
  selectedIndex,
  onSelect,
  mode,
  toolbar,
  heroControls,
}: StatusSlideDeckProps) {
  const slide = selectedSlide(slides, selectedIndex);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < slides.length - 1;
  const isLead = mode === "lead";
  const showLeadControls = isLead && slides.length > 1;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(Math.min(selectedIndex + 1, slides.length - 1));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(Math.max(selectedIndex - 1, 0));
    }
  }

  return (
    <section
      className="space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      data-testid={`${mode}-slides-deck`}
      aria-label="Status slide deck (use arrow keys to navigate slides)"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable keyboard-navigation region for arrow-key slide control
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {toolbar ? <div>{toolbar}</div> : null}

      {!slide ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-6 py-16 text-center">
          <p className="text-base font-semibold text-[var(--color-foreground)]">
            No slides available
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            There is no report section in the current scope.
          </p>
        </div>
      ) : (
        <>
          {showLeadControls ? (
            <div
              className="flex items-center justify-center gap-3"
              role="group"
              aria-label="Slide carousel controls"
            >
              <button
                type="button"
                onClick={() => onSelect(selectedIndex - 1)}
                disabled={!canGoPrev}
                aria-label="Previous slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span
                aria-live="polite"
                className="min-w-14 text-center text-sm font-semibold text-[var(--color-muted-foreground)]"
              >
                {selectedIndex + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => onSelect(selectedIndex + 1)}
                disabled={!canGoNext}
                aria-label="Next slide"
                className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className="space-y-3">
            {/* head-slides-carousel-fullscreen: the head deck navigates via a
                top carousel of slide cards, with the active slide rendered
                full-width below. */}
            {!isLead && slides.length > 1 ? (
              <HeadSlideCarousel
                slides={slides}
                selectedIndex={selectedIndex}
                onSelect={onSelect}
              />
            ) : null}

            {isLead ? (
              /* Keying by slide id + page remounts the article on navigation —
                 the Summary/Product state never leaks to another page. */
              <div className="overflow-x-auto">
                <SlideArticle
                  key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}
                  slide={slide}
                  heroControls={heroControls}
                />
              </div>
            ) : (
              <HeadSlideFrame
                key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}
                slide={slide}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
