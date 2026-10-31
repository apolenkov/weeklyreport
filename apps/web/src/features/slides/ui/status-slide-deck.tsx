"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, type RefObject, useRef } from "react";

import { useFullscreen } from "../../../shared/hooks/browser/use-fullscreen";
import type { SectionSlideModel } from "../model/section-slide-contracts";
import { slideArticleKey } from "../model/section-slide-pagination";
import {
  DeckFullscreenOverlay,
  DeckToolbarControls,
} from "./deck-fullscreen-overlay";
import { HeadSlideCarousel } from "./head-slide-carousel";
import { SlideArticle } from "./slide-article";
import type { SlideRowActivateHandler } from "./slide-article-rows";
import { SlideEmptyState } from "./slide-empty-state";

interface StatusSlideDeckProps {
  readonly slides: readonly SectionSlideModel[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly mode: "lead" | "head";
  readonly toolbar?: ReactNode | undefined;
  // The head shell may host fullscreen state and its toggle in the context
  // toolbar. When omitted, the standalone head deck owns both locally.
  readonly deckRef?: RefObject<HTMLDivElement | null> | undefined;
  readonly fullscreenToggleRef?:
    RefObject<HTMLButtonElement | null> | undefined;
  readonly isFullscreen?: boolean | undefined;
  readonly onToggle?: (() => void) | undefined;
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

// Arrow keys page the deck, except while a form control has focus or a
// modifier is held: Ctrl/Meta/Alt/Shift+Arrow belongs to the browser and AT
// (Find, word/selection movement, reading commands), so the deck leaves the
// event unprevented and emits no index for it. On an empty deck
// navigation is a no-op: no index (including -1) is emitted.
function makeArrowKeyHandler(
  selectedIndex: number,
  count: number,
  onSelect: (index: number) => void,
) {
  return (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isEditableTarget(e.target)) return;
    if (count === 0) return;
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
      data-testid="head-slide-scroll-host"
    >
      <DeckFullscreenOverlay isFullscreen={isFullscreen} onToggle={onToggle} />
      <SlideArticle key={slideArticleKey(slide)} slide={slide} />
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
    <div
      className="relative min-w-0 max-w-full overflow-x-auto"
      data-testid="lead-slide-scroll-host"
    >
      <SlideArticle
        key={slideArticleKey(props.slide)}
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

  return (
    <>
      {props.toolbar ? <div>{props.toolbar}</div> : null}

      {!slide ? (
        <SlideEmptyState
          title="No slides available"
          message="There is no report section in the current scope."
        />
      ) : (
        <>
          {isLead ? (
            <LeadCarouselControls
              selectedIndex={props.selectedIndex}
              total={props.slides.length}
              onSelect={props.onSelect}
            />
          ) : null}

          <div className="space-y-3">
            {!isLead ? (
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
  // fullscreen instance in `LeadSlidesClient`, and on a controlled Head
  // branch (single-listener invariant).
  const internalFrameRef = useRef<HTMLDivElement>(null);
  const internalFullscreenToggleRef = useRef<HTMLButtonElement>(null);
  const frameRef = props.deckRef ?? internalFrameRef;
  const fullscreenToggleRef =
    props.fullscreenToggleRef ?? internalFullscreenToggleRef;
  const externalFullscreen =
    props.mode === "head" &&
    props.isFullscreen !== undefined &&
    props.onToggle !== undefined;
  const localFullscreen = useFullscreen(
    frameRef,
    fullscreenToggleRef,
    props.mode !== "lead" && !externalFullscreen,
  );
  const fullscreen = externalFullscreen
    ? { isFullscreen: props.isFullscreen, toggle: props.onToggle }
    : localFullscreen;
  const toolbar =
    props.mode === "head" && !externalFullscreen ? (
      <div className="flex items-center justify-between gap-3">
        {props.toolbar}
        <DeckToolbarControls
          isFullscreen={fullscreen.isFullscreen}
          onToggle={fullscreen.toggle}
          toggleRef={fullscreenToggleRef}
        />
      </div>
    ) : (
      props.toolbar
    );

  return (
    <section
      className="min-w-0 max-w-full space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      data-testid={`${props.mode}-slides-deck`}
      data-layout-key="status-slide-deck"
      data-layout-stability="position-width"
      aria-label="Status slide deck (use arrow keys to navigate slides)"
      role="group"
      tabIndex={0}
      onKeyDown={makeArrowKeyHandler(
        props.selectedIndex,
        props.slides.length,
        props.onSelect,
      )}
    >
      <DeckBody
        {...props}
        toolbar={toolbar}
        frameRef={frameRef}
        fullscreen={fullscreen}
      />
    </section>
  );
}
