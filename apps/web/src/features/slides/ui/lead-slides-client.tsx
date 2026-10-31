"use client";

import {
  type ReactElement,
  type RefObject,
  useEffect,
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
  // Reports whether an inline editor dialog is open, so the host can keep the
  // deck mounted after it leaves Slides mode instead of discarding the draft.
  readonly onEditorOpenChange?: ((open: boolean) => void) | undefined;
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
  readonly toolbar: Parameters<typeof SlideSkeleton>[0]["toolbar"];
}): ReactElement | null {
  if (state.isLoading) {
    return <SlideSkeleton mode="lead" toolbar={state.toolbar} />;
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

// Clamp both stale upper bounds and defensive negative selections at render.
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
  showDensityControl,
  deckRef,
}: {
  readonly initialReportId: string | null;
  readonly foreignContent: readonly CrossAuthorContentRow[] | undefined;
  readonly foreignContentPending: boolean;
  readonly visibilityMode: "mine" | "everyone";
  readonly visibilityHydrated: boolean;
  readonly density: SlideDensity;
  readonly showDensityControl: boolean;
  readonly deckRef: RefObject<HTMLElement | null>;
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
    restoreFocusFallbackRef: deckRef,
  });
  const slides = useMemo(
    () => slidesForDensity(leadSlides.slides, density),
    [leadSlides.slides, density],
  );

  return {
    slides,
    hasOpenDialog: inlineEditor.hasOpenDialog,
    dialogs: inlineEditor.dialogs,
    onRowActivate: inlineEditor.onRowActivate,
    showFullscreenControls: !leadSlides.inReportMode,
    placeholder: deckPlaceholder({
      isLoading: leadSlides.isLoading,
      isError: leadSlides.isError,
      hasTargetReport: Boolean(leadSlides.targetReportId),
      toolbar: showDensityControl
        ? "density"
        : leadSlides.inReportMode
          ? "none"
          : "fullscreen",
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
  onEditorOpenChange,
}: LeadSlidesClientProps) {
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const [internalDensity, setInternalDensity] =
    useState<SlideDensity>("document");
  const activeDensity = density ?? internalDensity;
  const showDensityControl = density === undefined;
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
    showDensityControl,
    deckRef: externalDeckRef ?? internalDeckRef,
  });

  const editorOpen = deck.hasOpenDialog;
  useEffect(() => {
    onEditorOpenChange?.(editorOpen);
    // An unmounted deck has no editor; without this a stale "open" flag would
    // make the host hold a fresh, closed editor.
    return () => onEditorOpenChange?.(false);
  }, [editorOpen, onEditorOpenChange]);

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
      showDensityControl={showDensityControl}
      onDensityChange={handleDensityChange}
      selectedIndex={clampSelectedIndex(rawSelectedIndex, deck.slides.length)}
      onSelect={setSelectedIndex}
    />
  );
}
