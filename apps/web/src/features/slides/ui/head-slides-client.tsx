"use client";

import { useQuery } from "@tanstack/react-query";
import { type ReactElement, useMemo, useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import { buildActivitySlideModel } from "../model/activity-slide-model";
import { buildProductScopedSlides } from "../model/product-scoped-slides";
import { buildSectionSlideModel } from "../model/section-slide-model";
import { sortSlidesForReview } from "../model/section-slide-pagination";
import {
  type SlideDensity,
  slidesForDensity,
} from "../model/slide-density-pagination";
import { SlideDensityControl } from "./slide-density-control";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";
import { StatusSlideDeck } from "./status-slide-deck";

interface HeadSlidesClientProps {
  /** When provided, loads slides for that specific report period instead of
   * the current active period. Used by HeadReportShell slides mode. */
  readonly reportId?: string;
  // "product" aggregates every lead's content per product (head ScopeToggle).
  readonly scope?: "lead" | "product";
  // Viewer shell passes false so the empty-report fallback never hits a head-only procedure.
  readonly enableActivity?: boolean;
}

interface SlideDeckArgs {
  readonly reportId: string | undefined;
  readonly scope: "lead" | "product";
  readonly enableActivity: boolean;
  readonly density: SlideDensity;
}

function useHeadSlideDeck({
  reportId,
  scope,
  enableActivity,
  density,
}: SlideDeckArgs) {
  const trpc = useTRPC();

  const weeklyQ = useQuery(
    trpc.weeklyReport.get.queryOptions(reportId ? { reportId } : {}),
  );
  const activityQ = useQuery({
    ...trpc.activity.live.queryOptions(),
    enabled: enableActivity,
  });
  const needsActivityFallback =
    enableActivity &&
    weeklyQ.data !== undefined &&
    weeklyQ.data.status !== "no-period" &&
    weeklyQ.data.leadSections.length === 0;

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
    if (!needsActivityFallback) return [];
    return sortSlidesForReview(
      (activityQ.data?.rows ?? []).map((row) => buildActivitySlideModel(row)),
    );
  }, [weeklyQ.data, activityQ.data, scope, needsActivityFallback]);
  const slides = useMemo(
    () => slidesForDensity(documentSlides, density),
    [documentSlides, density],
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
function slideDeckFallback(state: SlideDeckState): ReactElement | null {
  if (state.isWeeklyLoading) return <SlideSkeleton />;

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

  if (state.isActivityLoading) return <SlideSkeleton />;

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

export function HeadSlidesClient({
  reportId,
  scope = "lead",
  enableActivity = true,
}: HeadSlidesClientProps = {}) {
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const [density, setDensity] = useState<SlideDensity>("document");

  const { weeklyQ, activityQ, needsActivityFallback, slides } =
    useHeadSlideDeck({ reportId, scope, enableActivity, density });

  // Two-sided clamp derived at render — see lead-slides-client: a negative
  // index from an empty-deck arrow press must clamp too, not just an
  // out-of-range one.
  const selectedIndex =
    rawSelectedIndex >= 0 && rawSelectedIndex < slides.length
      ? rawSelectedIndex
      : 0;

  const fallback = slideDeckFallback({
    isWeeklyLoading: weeklyQ.isLoading,
    isWeeklyError: weeklyQ.isError,
    hasPeriod: !!weeklyQ.data && weeklyQ.data.status !== "no-period",
    needsActivityFallback,
    isActivityLoading: activityQ.isLoading,
    isActivityError: activityQ.isError,
  });
  if (fallback) return fallback;

  return (
    <StatusSlideDeck
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      mode="head"
      toolbar={<SlideDensityControl value={density} onChange={setDensity} />}
    />
  );
}
