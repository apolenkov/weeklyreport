"use client";

import {
  type ReactElement,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";

import { useFullscreen } from "../../../shared/hooks/browser/use-fullscreen";
import type { CrossAuthorContentRow } from "../../report-sections";
import {
  type SlideDensity,
  slidesForDensity,
} from "../model/slide-density-pagination";
import { LeadSlidesDeckView } from "./lead/lead-slides-deck-view";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";
import { useLeadSlidesData } from "./use-lead-slides-data";
import { useSlideInlineEditor } from "./use-slide-inline-editor";

interface LeadSlidesClientBaseProps {
  readonly initialReportId?: string | null;
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly foreignContentPending: boolean;
  // Caller (lead-form header) can host the fullscreen button on the deck root.
  readonly deckRef?: RefObject<HTMLDivElement | null>;
  // Lead-form-hosted path owns fullscreen and density state; standalone owns
  // both controls locally.
  readonly isFullscreen?: boolean;
  readonly onToggle?: () => void;
  // Lead-form threads one useRecordVisibility instance for Mine vs Everyone; default Mine-only.
  readonly visibilityMode?: "mine" | "everyone";
  readonly visibilityHydrated?: boolean;
}

type LeadSlidesClientProps =
  | (LeadSlidesClientBaseProps & {
      readonly density?: undefined;
      readonly onDensityChange?: undefined;
    })
  | (LeadSlidesClientBaseProps & {
      readonly density: SlideDensity;
      readonly onDensityChange: (density: SlideDensity) => void;
    });

// What renders instead of the deck; `null` means the deck itself is ready.
function deckPlaceholder(state: {
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly hasTargetReport: boolean;
}): ReactElement | null {
  if (state.isLoading) {
    return <SlideSkeleton mode="lead" />;
  }
  if (state.isError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the report data is available."
      />
    );
  }
  if (!state.hasTargetReport) {
    return (
      <SlideEmptyState
        title="No active slide"
        message="There is no report section available for this session."
      />
    );
  }
  return null;
}

// Two-sided clamp at render: shrink can strand the index past the end, and an
// empty-deck ArrowRight stores -1, which a one-sided upper bound would accept.
function clampSelectedIndex(raw: number, slideCount: number): number {
  return raw >= 0 && raw < slideCount ? raw : 0;
}

// Standalone decks own the fullscreen hook; a host that threads its own state wins.
// Refs stay owned by the caller so no ref travels inside the returned object.
function useDeckFullscreen({
  internalDeckRef,
  toggleRef,
  externalIsFullscreen,
  externalOnToggle,
}: {
  readonly internalDeckRef: RefObject<HTMLDivElement | null>;
  readonly toggleRef: RefObject<HTMLButtonElement | null>;
  readonly externalIsFullscreen: boolean | undefined;
  readonly externalOnToggle: (() => void) | undefined;
}) {
  // Hosted path disables the local hook so only one fullscreenchange listener is active.
  const hosted = externalOnToggle !== undefined;
  const localFs = useFullscreen(internalDeckRef, toggleRef, !hosted);

  return {
    isFullscreen: externalIsFullscreen ?? localFs.isFullscreen,
    onToggle: externalOnToggle ?? localFs.toggle,
  };
}

// Slides, inline-edit dialogs and the placeholder that replaces the deck.
function useLeadSlidesDeck({
  initialReportId,
  foreignContent,
  foreignContentPending,
  visibilityMode,
  visibilityHydrated,
  density,
}: {
  readonly initialReportId: string | null;
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly foreignContentPending: boolean;
  readonly visibilityMode: "mine" | "everyone";
  readonly visibilityHydrated: boolean;
  readonly density: SlideDensity;
}) {
  const leadSlides = useLeadSlidesData({
    initialReportId,
    foreignContent,
    foreignContentPending,
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

  return {
    slides,
    dialogs: inlineEditor.dialogs,
    onRowActivate: inlineEditor.onRowActivate,
    showFullscreenControls: !leadSlides.inReportMode,
    placeholder: deckPlaceholder({
      isLoading: leadSlides.isLoading,
      isError: leadSlides.isError,
      hasTargetReport: Boolean(leadSlides.targetReportId),
    }),
  };
}

export function LeadSlidesClient({
  initialReportId = null,
  foreignContent,
  foreignContentPending,
  deckRef: externalDeckRef,
  isFullscreen: externalIsFullscreen,
  onToggle: externalOnToggle,
  visibilityMode = "mine",
  visibilityHydrated = false,
  density,
  onDensityChange,
}: LeadSlidesClientProps) {
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const [internalDensity, setInternalDensity] =
    useState<SlideDensity>("document");
  const activeDensity = density ?? internalDensity;
  const handleDensityChange = onDensityChange ?? setInternalDensity;
  const internalDeckRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useDeckFullscreen({
    internalDeckRef,
    toggleRef: toggleButtonRef,
    externalIsFullscreen,
    externalOnToggle,
  });
  const deck = useLeadSlidesDeck({
    initialReportId,
    foreignContent,
    foreignContentPending,
    visibilityMode,
    visibilityHydrated,
    density: activeDensity,
  });

  if (deck.placeholder !== null) {
    return deck.placeholder;
  }

  return (
    <LeadSlidesDeckView
      deckRef={externalDeckRef ?? internalDeckRef}
      toggleRef={toggleButtonRef}
      fullscreen={fullscreen}
      deck={deck}
      density={activeDensity}
      showDensityControl={density === undefined}
      onDensityChange={handleDensityChange}
      selectedIndex={clampSelectedIndex(rawSelectedIndex, deck.slides.length)}
      onSelect={setSelectedIndex}
    />
  );
}
