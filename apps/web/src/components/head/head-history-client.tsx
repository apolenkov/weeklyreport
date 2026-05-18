"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import type { CompiledHistoryResult } from "@customreport/shared";

import { useTRPC } from "../../lib/trpc-context";
import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import type { ReportPeriod } from "../lead/mock-data";
import { PeriodNavigator } from "../lead/period-navigator";
import { ArchiveToggle } from "../report-shell/archive-toggle";
import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";
import { HeadSlidesClient } from "../slides/head-slides-client";
import { SlideSkeleton } from "../slides/slide-skeleton";

/**
 * Phase 61 (robust-baking-aurora): head history page with period navigator
 * and inline form ↔ slides mode toggle. Uses compiledHistory to list
 * published periods; navigates via ?period=<reportId>&mode=<form|slides>.
 */
export function HeadHistoryClient() {
  const trpc = useTRPC();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get("mode");
  const mode = modeParam === "slides" ? "slides" : "form";
  const periodParam = searchParams.get("period");

  const [includeArchive, setIncludeArchive] = useState(false);

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );

  const periods: ReportPeriod[] = useMemo(() => {
    const data = historyQ.data as CompiledHistoryResult | undefined;
    if (!data?.entries?.length) return [];
    return data.entries.map((entry) => ({
      id: entry.reportId,
      weekLabel: `Week ${isoWeekNumber(new Date(entry.periodStart))}`,
      dateRange: formatDateRange(
        new Date(entry.periodStart),
        new Date(entry.periodEnd),
      ),
      archived: entry.archived,
      sourceSectionId: "",
      isCurrent: false,
      isSubmitted: true,
    }));
  }, [historyQ.data]);

  const selectedPeriodId = useMemo(() => {
    if (periodParam && periods.some((p) => p.id === periodParam)) {
      return periodParam;
    }
    return periods[0]?.id ?? null;
  }, [periodParam, periods]);

  const urlBuilder = useCallback(
    (periodId: string) => {
      const params = new URLSearchParams();
      params.set("period", periodId);
      if (mode !== "form") params.set("mode", mode);
      return `/head/history?${params.toString()}`;
    },
    [mode],
  );

  const editHref = useMemo(() => {
    if (!selectedPeriodId) return "/head/history";
    return `/head/history?period=${encodeURIComponent(selectedPeriodId)}`;
  }, [selectedPeriodId]);

  const slidesHref = useMemo(() => {
    if (!selectedPeriodId) return "/head/history?mode=slides";
    return `/head/history?period=${encodeURIComponent(selectedPeriodId)}&mode=slides`;
  }, [selectedPeriodId]);

  if (historyQ.isLoading) {
    return <WeeklyReportSkeleton />;
  }

  // Always render the toolbar so the ArchiveToggle is reachable even when all
  // periods are archived and the current filter returns nothing. The empty state
  // is scoped to the content area only.
  return (
    <div className="space-y-4">
      {/* Toolbar: period nav (only when periods exist) + archive toggle + mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 overflow-x-auto rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)] bg-[var(--color-surface-hover)]/70 px-2 py-1.5 whitespace-nowrap">
        {periods.length > 0 && (
          <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
        )}
        <ArchiveToggle checked={includeArchive} onChange={setIncludeArchive} />
        {periods.length > 0 && (
          <div className="flex gap-1">
            <ViewModeToggle editHref={editHref} slidesHref={slidesHref} />
          </div>
        )}
      </div>

      {/* Content */}
      {periods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgba(0,0,0,0.15)] bg-[var(--color-surface-hover)] p-12 text-center text-sm text-[var(--color-muted-foreground)]">
          {includeArchive
            ? "No published reports found."
            : "No published reports found. Try enabling archived periods."}
        </div>
      ) : selectedPeriodId ? (
        mode === "slides" ? (
          <Suspense fallback={<SlideSkeleton />}>
            <HeadSlidesClient reportId={selectedPeriodId} />
          </Suspense>
        ) : (
          <Suspense fallback={<WeeklyReportSkeleton />}>
            <WeeklyReportPage reportId={selectedPeriodId} />
          </Suspense>
        )
      ) : null}
    </div>
  );
}
