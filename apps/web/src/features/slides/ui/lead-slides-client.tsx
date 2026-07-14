"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import { useFullscreen } from "../../../hooks/use-fullscreen";
import { useSlideInlineEditor } from "../../report-sections";
import {
  DeckFullscreenOverlay,
  DeckToolbarControls,
} from "./deck-fullscreen-overlay";
import { ReportSlides } from "./report-slides";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";
import { useLeadSlidesData } from "./use-lead-slides-data";

interface LeadSlidesClientProps {
  readonly initialReportId?: string | null;
  readonly chrome?: "full" | "content";
  /** W9.A: when provided, this ref is applied to the deck root div so the
   *  caller (lead-form header) can host the fullscreen button. */
  readonly deckRef?: RefObject<HTMLDivElement | null>;
  /**
   * add-slide-fullscreen-exit-affordance: on the lead-form-hosted path the
   * caller owns the single `useFullscreen` hook and threads its state here, so
   * the deck's floating pill + Esc hint are presentational and add no second
   * listener. Absent on the standalone path, where the deck owns the hook.
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const internalDeckRef = useRef<HTMLDivElement>(null);
  const deckRef = externalDeckRef ?? internalDeckRef;
  // add-slide-fullscreen-exit-affordance: the lead-form-hosted path passes
  // isFullscreen/onToggle (it owns the single hook), so the local hook is
  // disabled to keep exactly one `f`/fullscreenchange listener. The standalone
  // path owns the hook here and returns focus to its toolbar toggle on exit.
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

  useEffect(() => {
    // Two-sided clamp: a shrink strands the index past the end, and an
    // ArrowRight on an EMPTY deck stores -1 (Math.min(length-1, ...)), which a
    // one-sided upper-bound check would accept forever once slides arrive.
    if (selectedIndex >= 0 && selectedIndex < leadSlides.slides.length) return;
    setSelectedIndex(0);
  }, [selectedIndex, leadSlides.slides.length]);

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
        slides={leadSlides.slides}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        variant="lead"
        onRowActivate={inlineEditor.onRowActivate}
        toolbar={
          !leadSlides.inReportMode ? (
            <div className="flex items-center gap-2">
              <DeckToolbarControls
                isFullscreen={isFullscreen}
                onToggle={onToggle}
                toggleRef={toggleButtonRef}
              />
            </div>
          ) : undefined
        }
      />
      <DeckFullscreenOverlay isFullscreen={isFullscreen} onToggle={onToggle} />
      {inlineEditor.dialogs}
    </div>
  );
}
