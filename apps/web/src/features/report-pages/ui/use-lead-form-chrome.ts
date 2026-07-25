"use client";

import type { MyHistoryEntry } from "@customreport/shared";
import { useEffect, useMemo, useState } from "react";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";

interface UseLeadFormChromeInput {
  readonly pinnedReportId: string | undefined;
  readonly activeReportId: string;
  readonly byPeriodData: { section: { reportId: string } } | undefined;
  readonly history: readonly MyHistoryEntry[] | undefined;
}

export function useLeadFormChrome({
  pinnedReportId,
  activeReportId,
  byPeriodData,
  history,
}: UseLeadFormChromeInput): {
  selectedPeriodId: string;
  showArchivePeriods: boolean;
  setShowArchivePeriods: (next: boolean) => void;
} {
  // Title from the history entry matching the loaded section so the tab
  // label matches the period dropdown; restored on unmount.
  const titleHistoryEntry = useMemo(() => {
    if (!byPeriodData?.section.reportId || !history) return null;
    return (
      history.find((h) => h.reportId === byPeriodData.section.reportId) ?? null
    );
  }, [byPeriodData, history]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleHistoryEntry) return;
    const start = titleHistoryEntry.periodStart;
    const week = isoWeekNumber(start);
    const range = formatPeriodRangeWithYear(start, titleHistoryEntry.periodEnd);
    const previous = document.title;
    document.title = `Week ${week}, ${range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleHistoryEntry]);

  // Manual archive toggle is paired with the period it was made on; other
  // periods fall back to auto-expand when the selected period is archived.
  const [archiveToggle, setArchiveToggle] = useState<{
    readonly periodId: string;
    readonly value: boolean;
  } | null>(null);
  const selectedPeriodId = pinnedReportId || activeReportId || "";
  const selectedHistoryPeriod = history?.find(
    (entry) => entry.reportId === selectedPeriodId && entry.reportId !== "",
  );
  const showArchivePeriods =
    archiveToggle !== null && archiveToggle.periodId === selectedPeriodId
      ? archiveToggle.value
      : selectedHistoryPeriod?.archived === true;
  const setShowArchivePeriods = (next: boolean) =>
    setArchiveToggle({ periodId: selectedPeriodId, value: next });

  return { selectedPeriodId, showArchivePeriods, setShowArchivePeriods };
}
