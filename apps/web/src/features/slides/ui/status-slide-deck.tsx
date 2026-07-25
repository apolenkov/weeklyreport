"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, type RefObject, useRef } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import type { SectionSlideModel } from "../model/section-slide-contracts";
import { DeckFullscreenOverlay } from "./deck-fullscreen-overlay";
import { HeadSlideCarousel } from "./head-slide-carousel";
import { SlideArticle } from "./slide-article";
import type { SlideRowActivateHandler } from "./slide-article-rows";

interface StatusSlideDeckProps {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly mode: "lead" | "head";
  readonly toolbar?: ReactNode;
  readonly heroControls?: ReactNode;
  readonly onRowActivate?: SlideRowActivateHandler;
}

function selectedSlide(
  slides: readonly SectionSlideModel[],
  index: number,
): SectionSlideModel | undefined {
  return index >= 0 && index < slides.length ? slides[index] : undefined;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.matches("input, textarea, select")) return true;
  const editableAncestor = target.closest("[contenteditable]");
  return (
    editableAncestor !== null &&
    editableAncestor.getAttribute("contenteditable") !== "false"
  );
}

// Unkeyed wrapper so the fullscreened DOM node survives slide navigation;
// browsers force-exit fullscreen if the requested element unmounts.
function HeadSlideFrame({
  slide,
  frameRef,
  isFullscreen,
  onToggle,
}: {
  readonly slide: SectionSlideModel;
  readonly frameRef: RefObject<HTMLDivElement | null>;
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div
      ref={frameRef}
      tabIndex={-1}
      className="relative overflow-auto bg-[var(--color-background)]"
    >
      <DeckFullscreenOverlay isFullscreen={isFullscreen} onToggle={onToggle} />
      <SlideArticle
        key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}
        slide={slide}
      />
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
  onRowActivate,
}: StatusSlideDeckProps) {
  const slide = selectedSlide(slides, selectedIndex);
  const canGoPrev = selectedIndex > 0;
  const canGoNext = selectedIndex < slides.length - 1;
  const isLead = mode === "lead";
  const showLeadControls = isLead && slides.length > 1;
  // Hoisted to the persistent root (never remounted by `selectedIndex`
  // changes) so arrow-key/carousel navigation cannot tear down the actual
  // fullscreened element. Disabled on the lead branch, which owns its own
  // fullscreen instance in `LeadSlidesClient` (single-listener invariant).
  const frameRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(frameRef, frameRef, !isLead);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (isEditableTarget(e.target)) return;
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
            {!isLead && slides.length > 1 ? (
              <HeadSlideCarousel
                slides={slides}
                selectedIndex={selectedIndex}
                onSelect={onSelect}
              />
            ) : null}

            {isLead ? (
              /* Keying by slide id + page remounts the article on navigation,
                 resetting any article-local state for the next page. */
              <div className="overflow-x-auto">
                <SlideArticle
                  key={`${slide.id}:${String(slide.pageIndex ?? 0)}`}
                  slide={slide}
                  heroControls={heroControls}
                  onRowActivate={onRowActivate}
                />
              </div>
            ) : (
              <HeadSlideFrame
                slide={slide}
                frameRef={frameRef}
                isFullscreen={fullscreen.isFullscreen}
                onToggle={fullscreen.toggle}
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
