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
import { ReportSlides } from "./report-slides";
import { SlideDensityControl } from "./slide-density-control";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";
import { useLeadSlidesData } from "./use-lead-slides-data";
import { useSlideInlineEditor } from "./use-slide-inline-editor";

interface LeadSlidesClientProps {
  readonly initialReportId?: string | null;
  /** When provided, this ref is applied to the deck root div so the caller
   *  (lead-form header) can host the fullscreen button. */
  readonly deckRef?: RefObject<HTMLDivElement | null>;
  /**
   * On the lead-form-hosted path the caller owns the single `useFullscreen`
   * hook and threads its state here, so the deck's floating pill + Esc hint
   * are presentational and add no second listener. Absent on the standalone
   * path, where the deck owns the hook.
   */
  readonly isFullscreen?: boolean;
  readonly onToggle?: () => void;
  /**
   * slides-record-visibility: the lead-form owns the Record-visibility toggle
   * (one `useRecordVisibility` instance) and threads its state down so the deck
   * shows Mine vs Everyone. Defaults keep the deck Mine-only for any caller that
   * does not drive the toggle.
   */
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
  // The lead-form-hosted path passes isFullscreen/onToggle (it owns the single
  // hook), so the local hook is disabled to keep exactly one fullscreenchange
  // listener. The standalone path owns the hook here and returns focus to its
  // toolbar toggle on exit.
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

  // Two-sided clamp derived at render (no reset effect): a shrink strands the
  // stored index past the end, and an ArrowRight on an EMPTY deck stores -1
  // (Math.min(length-1, ...)), which a one-sided upper-bound check would
  // accept forever once slides arrive. The child always navigates from this
  // clamped value, so the stale raw value is never observed.
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
      <ReportSlides
        slides={slides}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        variant="lead"
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
