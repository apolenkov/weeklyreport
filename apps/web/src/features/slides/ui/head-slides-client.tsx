"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
import { ReportSlides } from "./report-slides";
import { SlideDensityControl } from "./slide-density-control";
import { SlideEmptyState } from "./slide-empty-state";
import { SlideSkeleton } from "./slide-skeleton";

interface HeadSlidesClientProps {
  /** When provided, loads slides for that specific report period instead of
   * the current active period. Used by HeadReportShell slides mode. */
  readonly reportId?: string;
  /**
   * Grouping axis for the deck. "lead" (default) = one slide per lead section;
   * "product" transposes into one slide per product, aggregating every lead's
   * content for that product. Driven by the head shell ScopeToggle.
   */
  readonly scope?: "lead" | "product";
  /**
   * The empty-report fallback uses a head-only procedure. The viewer shell
   * passes `false` so its deck depends only on published sections.
   */
  readonly enableActivity?: boolean;
}

export function HeadSlidesClient({
  reportId,
  scope = "lead",
  enableActivity = true,
}: HeadSlidesClientProps = {}) {
  const trpc = useTRPC();
  const [rawSelectedIndex, setSelectedIndex] = useState(0);
  const [density, setDensity] = useState<SlideDensity>("document");

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

  // Two-sided clamp derived at render — see lead-slides-client: a negative
  // index from an empty-deck arrow press must clamp too, not just an
  // out-of-range one.
  const selectedIndex =
    rawSelectedIndex >= 0 && rawSelectedIndex < slides.length
      ? rawSelectedIndex
      : 0;

  if (weeklyQ.isLoading) return <SlideSkeleton />;

  if (weeklyQ.isError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the weekly report is available."
      />
    );
  }

  if (!weeklyQ.data || weeklyQ.data.status === "no-period") {
    return (
      <SlideEmptyState
        title="No active deck"
        message="There is no open or reopened report period to assemble into slides."
      />
    );
  }

  if (needsActivityFallback && activityQ.isLoading) return <SlideSkeleton />;

  if (needsActivityFallback && activityQ.isError) {
    return (
      <SlideEmptyState
        title="Slides could not load"
        message="Refresh the page after the weekly report is available."
      />
    );
  }

  return (
    <ReportSlides
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      variant="head"
      toolbar={<SlideDensityControl value={density} onChange={setDensity} />}
    />
  );
}
