"use client";

import { type ReactNode, type RefObject, useState } from "react";

import { PortalTargetProvider } from "../../../../shared/ui/dialogs/document-body-portal";
import type { SectionSlideModel } from "../../model/section-slide-contracts";
import type { SlideDensity } from "../../model/slide-density-pagination";
import {
  DeckFullscreenOverlay,
  DeckToolbarControls,
} from "../deck-fullscreen-overlay";
import type { SlideRowActivateHandler } from "../slide-article-rows";
import { SlideDensityControl } from "../slide-density-control";
import { StatusSlideDeck } from "../status-slide-deck";

interface LeadDeckFullscreen {
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
}

interface LeadSlidesDeckPresentation {
  readonly slides: readonly SectionSlideModel[];
  readonly dialogs: ReactNode;
  readonly onRowActivate?: SlideRowActivateHandler | undefined;
  readonly showFullscreenControls: boolean;
}

function deckSurfaceClass(isFullscreen: boolean): string | undefined {
  return isFullscreen
    ? "h-screen overflow-auto bg-[var(--color-background)] p-4"
    : "min-w-0 max-w-full";
}

function DeckToolbar({
  density,
  onDensityChange,
  showDensity,
  showFullscreenControls,
  fullscreen,
  toggleRef,
}: {
  readonly density: SlideDensity;
  readonly onDensityChange: (next: SlideDensity) => void;
  readonly showDensity: boolean;
  readonly showFullscreenControls: boolean;
  readonly fullscreen: LeadDeckFullscreen;
  readonly toggleRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {showDensity ? (
        <SlideDensityControl value={density} onChange={onDensityChange} />
      ) : null}
      {showFullscreenControls ? (
        <DeckToolbarControls
          isFullscreen={fullscreen.isFullscreen}
          onToggle={fullscreen.onToggle}
          toggleRef={toggleRef}
        />
      ) : null}
    </div>
  );
}

export function LeadSlidesDeckView({
  deckRef,
  toggleRef,
  fullscreen,
  deck,
  density,
  showDensityControl,
  onDensityChange,
  held = false,
  selectedIndex,
  onSelect,
}: {
  readonly deckRef: RefObject<HTMLDivElement | null>;
  readonly toggleRef: RefObject<HTMLButtonElement | null>;
  readonly fullscreen: LeadDeckFullscreen;
  readonly deck: LeadSlidesDeckPresentation;
  readonly density: SlideDensity;
  readonly showDensityControl: boolean;
  readonly onDensityChange: (next: SlideDensity) => void;
  // Held: the host left Slides mode with an editor open; only its dialogs render.
  readonly held?: boolean;
  readonly selectedIndex: number;
  readonly onSelect: (next: number) => void;
}) {
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const deckToolbar =
    showDensityControl || deck.showFullscreenControls ? (
      <DeckToolbar
        density={density}
        onDensityChange={onDensityChange}
        showDensity={showDensityControl}
        showFullscreenControls={deck.showFullscreenControls}
        fullscreen={fullscreen}
        toggleRef={toggleRef}
      />
    ) : undefined;

  return (
    <div
      ref={deckRef}
      tabIndex={-1}
      className={held ? "contents" : deckSurfaceClass(fullscreen.isFullscreen)}
    >
      {held ? null : (
        <>
          <StatusSlideDeck
            slides={deck.slides}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            mode="lead"
            onRowActivate={deck.onRowActivate}
            toolbar={deckToolbar}
          />
          <DeckFullscreenOverlay
            isFullscreen={fullscreen.isFullscreen}
            onToggle={fullscreen.onToggle}
          />
        </>
      )}
      {/* Dialogs must portal inside the fullscreened element to stay visible. */}
      <PortalTargetProvider target={portalTarget}>
        {deck.dialogs}
      </PortalTargetProvider>
      <div ref={setPortalTarget} className="contents" />
    </div>
  );
}
