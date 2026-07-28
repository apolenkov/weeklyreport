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
  readonly toolbar?: ReactNode | undefined;
  readonly heroControls?: ReactNode | undefined;
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
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

// Arrow keys page the deck, except while a form control has focus.
function makeArrowKeyHandler(
  selectedIndex: number,
  count: number,
  onSelect: (index: number) => void,
) {
  return (e: React.KeyboardEvent) => {
    if (isEditableTarget(e.target)) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSelect(Math.min(selectedIndex + 1, count - 1));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSelect(Math.max(selectedIndex - 1, 0));
    }
  };
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

function EmptyDeckState() {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-6 py-16 text-center">
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        No slides available
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        There is no report section in the current scope.
      </p>
    </div>
  );
}

const CAROUSEL_BUTTON_CLASSNAME =
  "inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-35";

function LeadCarouselControls({
  selectedIndex,
  total,
  onSelect,
}: {
  readonly selectedIndex: number;
  readonly total: number;
  readonly onSelect: (index: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-center gap-3"
      role="group"
      aria-label="Slide carousel controls"
    >
      <button
        type="button"
        onClick={() => onSelect(selectedIndex - 1)}
        disabled={selectedIndex <= 0}
        aria-label="Previous slide"
        className={CAROUSEL_BUTTON_CLASSNAME}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <span
        aria-live="polite"
        className="min-w-14 text-center text-sm font-semibold text-[var(--color-muted-foreground)]"
      >
        {selectedIndex + 1} / {total}
      </span>
      <button
        type="button"
        onClick={() => onSelect(selectedIndex + 1)}
        disabled={selectedIndex >= total - 1}
        aria-label="Next slide"
        className={CAROUSEL_BUTTON_CLASSNAME}
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

type DeckBodyProps = StatusSlideDeckProps & {
  readonly frameRef: RefObject<HTMLDivElement | null>;
  readonly fullscreen: ReturnType<typeof useFullscreen>;
};

type DeckArticleProps = DeckBodyProps & {
  readonly slide: SectionSlideModel;
  readonly isLead: boolean;
};

function DeckArticle(props: DeckArticleProps) {
  if (!props.isLead) {
    return (
      <HeadSlideFrame
        slide={props.slide}
        frameRef={props.frameRef}
        isFullscreen={props.fullscreen.isFullscreen}
        onToggle={props.fullscreen.toggle}
      />
    );
  }
  // Keying by slide id + page remounts the article on navigation, resetting
  // any article-local state for the next page.
  return (
    <div className="overflow-x-auto">
      <SlideArticle
        key={`${props.slide.id}:${String(props.slide.pageIndex ?? 0)}`}
        slide={props.slide}
        heroControls={props.heroControls}
        onRowActivate={props.onRowActivate}
      />
    </div>
  );
}

// Toolbar + either the empty state or the navigable article.
function DeckBody(props: DeckBodyProps) {
  const slide = selectedSlide(props.slides, props.selectedIndex);
  const isLead = props.mode === "lead";
  const hasSiblings = props.slides.length > 1;

  return (
    <>
      {props.toolbar ? <div>{props.toolbar}</div> : null}

      {!slide ? (
        <EmptyDeckState />
      ) : (
        <>
          {isLead && hasSiblings ? (
            <LeadCarouselControls
              selectedIndex={props.selectedIndex}
              total={props.slides.length}
              onSelect={props.onSelect}
            />
          ) : null}

          <div className="space-y-3">
            {!isLead && hasSiblings ? (
              <HeadSlideCarousel
                slides={props.slides}
                selectedIndex={props.selectedIndex}
                onSelect={props.onSelect}
              />
            ) : null}

            <DeckArticle {...props} slide={slide} isLead={isLead} />
          </div>
        </>
      )}
    </>
  );
}

export function StatusSlideDeck(props: StatusSlideDeckProps) {
  // Hoisted to the persistent root (never remounted by `selectedIndex`
  // changes) so arrow-key/carousel navigation cannot tear down the actual
  // fullscreened element. Disabled on the lead branch, which owns its own
  // fullscreen instance in `LeadSlidesClient` (single-listener invariant).
  const frameRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(frameRef, frameRef, props.mode !== "lead");

  return (
    <section
      className="space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      data-testid={`${props.mode}-slides-deck`}
      aria-label="Status slide deck (use arrow keys to navigate slides)"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable keyboard-navigation region for arrow-key slide control
      tabIndex={0}
      onKeyDown={makeArrowKeyHandler(
        props.selectedIndex,
        props.slides.length,
        props.onSelect,
      )}
    >
      <DeckBody {...props} frameRef={frameRef} fullscreen={fullscreen} />
    </section>
  );
}
