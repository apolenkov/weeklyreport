"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactElement, type RefObject, useMemo, useState } from "react";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { buildActivitySlideModel } from "../model/activity-slide-model";
import { buildProductScopedSlides } from "../model/product-scoped-slides";
import { buildSectionSlideModel } from "../model/section-slide-model";
import { sortSlidesForReview } from "../model/section-slide-pagination";
import { slidesForDensity } from "../model/slide-density-pagination";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";
import { StatusSlideDeck } from "./status-slide-deck";

interface HeadSlidesClientBaseProps {
  // When set, load the requested report period instead of the active period.
  readonly reportId?: string;
  // "product" aggregates every lead's content per product (head ScopeToggle).
  readonly scope?: "lead" | "product";
  // Viewer shell passes false so the empty-report fallback never hits a head-only procedure.
  readonly enableActivity?: boolean;
  // Head shell hosts fullscreen controls in its context toolbar.
  readonly deckRef?: RefObject<HTMLDivElement | null>;
  readonly fullscreenToggleRef?: RefObject<HTMLButtonElement | null>;
  readonly isFullscreen?: boolean;
  readonly onToggle?: () => void;
}

type HeadSlidesClientProps = HeadSlidesClientBaseProps;

interface SlideDeckArgs {
  readonly reportId: string | undefined;
  readonly scope: "lead" | "product";
  readonly enableActivity: boolean;
}

function useHeadSlideDeck({ reportId, scope, enableActivity }: SlideDeckArgs) {
  const trpc = useTRPC();

  const weeklyQ = useQuery(
    trpc.weeklyReport.get.queryOptions(reportId ? { reportId } : {}),
  );
  const needsActivityFallback =
    enableActivity &&
    weeklyQ.data !== undefined &&
    weeklyQ.data.status !== "no-period" &&
    !weeklyQ.data.archived &&
    weeklyQ.data.periodStatus !== "published" &&
    weeklyQ.data.leadSections.length === 0;
  const activityQ = useQuery({
    ...trpc.activity.live.queryOptions(),
    enabled: needsActivityFallback,
  });

  useQueryErrorHandler(weeklyQ, {
    event: "headSlides.weeklyReport.load_failed",
    component: "HeadSlidesClient",
    procedure: "weeklyReport.get",
  });

  const documentSlides = useMemo(() => {
    if (!weeklyQ.data || weeklyQ.data.status === "no-period") return [];
    if (weeklyQ.data.leadSections.length > 0) {
      const base =
        scope === "product"
          ? buildProductScopedSlides(weeklyQ.data.leadSections)
          : weeklyQ.data.leadSections.map((section) =>
              buildSectionSlideModel(section),
            );
      return sortSlidesForReview(base);
    }
    if (
      !needsActivityFallback ||
      activityQ.data?.reportId !== weeklyQ.data.reportId
    )
      return [];
    return sortSlidesForReview(
      activityQ.data.rows.map((row) => buildActivitySlideModel(row)),
    );
  }, [weeklyQ.data, activityQ.data, scope, needsActivityFallback]);
  const slides = useMemo(
    () => slidesForDensity(documentSlides, "document"),
    [documentSlides],
  );

  return { weeklyQ, activityQ, needsActivityFallback, slides };
}

interface SlideDeckState {
  readonly isWeeklyLoading: boolean;
  readonly isWeeklyError: boolean;
  readonly hasPeriod: boolean;
  readonly needsActivityFallback: boolean;
  readonly isActivityLoading: boolean;
  readonly isActivityError: boolean;
}

// The non-deck states, in the order they must win: the weekly report gates
// everything, and the activity fallback only gates when it is the source.
function slideDeckFallback(
  state: SlideDeckState,
  toolbar: Parameters<typeof SlideSkeleton>[0]["toolbar"],
): ReactElement | null {
  if (state.isWeeklyLoading)
    return <SlideSkeleton mode="head" toolbar={toolbar} />;

  if (state.isWeeklyError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the weekly report is available."
      />
    );
  }

  if (!state.hasPeriod) {
    return (
      <SlideEmptyState
        title="No active deck"
        message="There is no open or reopened report period to assemble into slides."
      />
    );
  }

  if (!state.needsActivityFallback) return null;

  if (state.isActivityLoading)
    return <SlideSkeleton mode="head" toolbar={toolbar} />;

  if (state.isActivityError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the weekly report is available."
      />
    );
  }

  return null;
}

function clampSelectedIndex(raw: number, slideCount: number): number {
  return raw >= 0 && raw < slideCount ? raw : 0;
}

export function HeadSlidesClient({
  reportId,
  scope = "lead",
  enableActivity = true,
  deckRef,
  fullscreenToggleRef,
  isFullscreen,
  onToggle,
}: HeadSlidesClientProps = {}) {
  const [rawSelectedIndex, setSelectedIndex] = useState(0);

  const { weeklyQ, activityQ, needsActivityFallback, slides } =
    useHeadSlideDeck({
      reportId,
      scope,
      enableActivity,
    });

  // Clamp both stale upper bounds and defensive negative selections at render.
  const selectedIndex = clampSelectedIndex(rawSelectedIndex, slides.length);

  const fallback = slideDeckFallback(
    {
      isWeeklyLoading: weeklyQ.isLoading,
      isWeeklyError: weeklyQ.isError,
      hasPeriod: !!weeklyQ.data && weeklyQ.data.status !== "no-period",
      needsActivityFallback,
      isActivityLoading: activityQ.isLoading,
      isActivityError: activityQ.isError,
    },
    isFullscreen !== undefined && onToggle !== undefined
      ? "none"
      : "fullscreen",
  );
  if (fallback) return fallback;

  return (
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      mode="head"
      deckRef={deckRef}
      fullscreenToggleRef={fullscreenToggleRef}
      isFullscreen={isFullscreen}
      onToggle={onToggle}
    />
  );
}
