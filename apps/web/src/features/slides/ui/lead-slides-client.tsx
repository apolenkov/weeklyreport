"use client";

import { type RefObject, useMemo, useRef, useState } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import {
  type SlideDensity,
  slidesForDensity,
} from "../model/slide-density-pagination";
import {
  DeckFullscreenOverlay,
  DeckToolbarControls,
} from "./deck-fullscreen-overlay";
import { SlideDensityControl } from "./slide-density-control";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";
import { StatusSlideDeck } from "./status-slide-deck";
import { useLeadSlidesData } from "./use-lead-slides-data";
import { useSlideInlineEditor } from "./use-slide-inline-editor";

interface LeadSlidesClientProps {
  readonly initialReportId?: string | null;
  // Caller (lead-form header) can host the fullscreen button on the deck root.
  readonly deckRef?: RefObject<HTMLDivElement | null>;
  // Lead-form-hosted path owns useFullscreen and threads state; standalone owns the hook.
  readonly isFullscreen?: boolean;
  readonly onToggle?: () => void;
  // Lead-form threads one useRecordVisibility instance for Mine vs Everyone; default Mine-only.
  readonly visibilityMode?: "mine" | "everyone";
  readonly visibilityHydrated?: boolean;
}

export function LeadSlidesClient({
  initialReportId = null,
  deckRef: externalDeckRef,
  isFullscreen: externalIsFullscreen,
  onToggle: externalOnToggle,
  visibilityMode = "mine",
  visibilityHydrated = false,
}: LeadSlidesClientProps) {
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const [density, setDensity] = useState<SlideDensity>("document");
  const internalDeckRef = useRef<HTMLDivElement>(null);
  const deckRef = externalDeckRef ?? internalDeckRef;
  // Hosted path disables the local hook so only one fullscreenchange listener is active.
  const hosted = externalOnToggle !== undefined;
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const localFs = useFullscreen(internalDeckRef, toggleButtonRef, !hosted);
  const isFullscreen = externalIsFullscreen ?? localFs.isFullscreen;
  const onToggle = externalOnToggle ?? localFs.toggle;
  const leadSlides = useLeadSlidesData({
    initialReportId,
    visibilityMode,
    visibilityHydrated,
  });
  const inlineEditor = useSlideInlineEditor({
    section: leadSlides.section,
    formData: leadSlides.formData,
    canInlineEdit: leadSlides.canInlineEdit,
    refetchSection: leadSlides.refetchSection,
  });
  const slides = useMemo(
    () => slidesForDensity(leadSlides.slides, density),
    [leadSlides.slides, density],
  );

  // Two-sided clamp at render: shrink can strand the index past the end, and an
  // empty-deck ArrowRight stores -1, which a one-sided upper bound would accept.
  const selectedIndex =
    rawSelectedIndex >= 0 && rawSelectedIndex < slides.length
      ? rawSelectedIndex
      : 0;

  if (leadSlides.isLoading) {
    return <SlideSkeleton />;
  }

  if (leadSlides.isError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the report data is available."
      />
    );
  }

  if (!leadSlides.targetReportId) {
    return (
      <SlideEmptyState
        title="No active slide"
        message="There is no report section available for this session."
      />
    );
  }

  return (
    <div
      ref={deckRef}
      className={
        isFullscreen
          ? "h-screen overflow-auto bg-[var(--color-background)] p-4"
          : undefined
      }
    >
      <StatusSlideDeck
        slides={slides}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        mode="lead"
        onRowActivate={inlineEditor.onRowActivate}
        toolbar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SlideDensityControl value={density} onChange={setDensity} />
            {!leadSlides.inReportMode ? (
              <DeckToolbarControls
                isFullscreen={isFullscreen}
                onToggle={onToggle}
                toggleRef={toggleButtonRef}
              />
            ) : null}
          </div>
        }
      />
      <DeckFullscreenOverlay isFullscreen={isFullscreen} onToggle={onToggle} />
      {inlineEditor.dialogs}
    </div>
  );
}
