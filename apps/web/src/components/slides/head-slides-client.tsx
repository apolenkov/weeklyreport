"use client";

import { useQuery } from "@tanstack/react-query";
import { useContext, useEffect, useMemo, useState } from "react";

import { logClientError } from "../../lib/client-error-reporting";
import { formatWeekRange } from "../../lib/mappers/weekly-report";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import { ReportSlides } from "./report-slides";
import {
  buildActivitySlideModel,
  buildProductScopedSlides,
  buildSectionSlideModel,
  paginateSectionSlides,
  sortSlidesForReview,
} from "./section-slide-utils";
import { SlideSkeleton } from "./slide-skeleton";

function SlideEmptyState({
  title,
  message,
}: {
  readonly title: string;
  readonly message: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center">
      <p className="text-base font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        {message}
      </p>
    </div>
  );
}

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
}

export function HeadSlidesClient({
  reportId,
  scope = "lead",
}: HeadSlidesClientProps = {}) {
  const trpc = useTRPC();
  const session = useContext(SessionContext);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const weeklyQ = useQuery(
    trpc.weeklyReport.get.queryOptions(reportId ? { reportId } : {}),
  );
  const activityQ = useQuery(trpc.activity.live.queryOptions());

  useEffect(() => {
    if (!weeklyQ.isError) return;
    logClientError("headSlides.weeklyReport.load_failed", weeklyQ.error, {
      component: "HeadSlidesClient",
      procedure: "weeklyReport.get",
    });
  }, [weeklyQ.isError, weeklyQ.error]);

  const slides = useMemo(() => {
    if (!weeklyQ.data || weeklyQ.data.status === "no-period") return [];
    if (weeklyQ.data.leadSections.length > 0) {
      const base =
        scope === "product"
          ? buildProductScopedSlides(weeklyQ.data.leadSections)
          : weeklyQ.data.leadSections.map((section) =>
              buildSectionSlideModel(section),
            );
      return sortSlidesForReview(
        base.flatMap((model) => paginateSectionSlides(model)),
      );
    }
    return sortSlidesForReview(
      (activityQ.data?.rows ?? []).map((row) => buildActivitySlideModel(row)),
    );
  }, [weeklyQ.data, activityQ.data, scope]);

  useEffect(() => {
    if (selectedIndex < slides.length) return;
    setSelectedIndex(0);
  }, [selectedIndex, slides.length]);

  const selectedSlide =
    slides.at(Math.min(Math.max(selectedIndex, 0), slides.length - 1)) ?? null;
  const activeReportId =
    weeklyQ.data && weeklyQ.data.status === "active"
      ? weeklyQ.data.reportId
      : null;
  const reportLabel =
    weeklyQ.data && weeklyQ.data.status === "active"
      ? `${weeklyQ.data.weekLabel ?? "Current week"} - ${formatWeekRange(
          weeklyQ.data.periodStart,
          weeklyQ.data.periodEnd,
        )}`
      : null;
  const sourceHref =
    activeReportId && selectedSlide
      ? `/head/report/${encodeURIComponent(
          activeReportId,
        )}?authorId=${encodeURIComponent(selectedSlide.ownerId)}`
      : undefined;

  if (weeklyQ.isLoading || activityQ.isLoading) {
    return <SlideSkeleton />;
  }

  if (weeklyQ.isError || activityQ.isError) {
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

  return (
    <ReportSlides
      slides={slides}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      variant="head"
      title="Group Status Slides"
      subtitle="Group deck ordered by review risk before publishing."
      groupLabel={session?.user?.reportingGroupName ?? "Group scope"}
      reportLabel={reportLabel}
      sourceHref={sourceHref}
      sourceLabel="Open focused report"
    />
  );
}
