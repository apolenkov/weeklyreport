"use client";

import type { MyHistoryEntry } from "@customreport/shared";
import { useEffect, useMemo, useState } from "react";

import { formatDateRange, isoWeekNumber } from "../model/lead-history";

interface UseLeadFormChromeInput {
  readonly pinnedReportId: string | undefined;
  readonly activeReportId: string;
  /** `leadForm.byPeriod` result; only the section's reportId is read. */
  readonly byPeriodData: { section: { reportId: string } } | undefined;
  readonly history: readonly MyHistoryEntry[] | undefined;
}

/**
 * The lead form's page chrome: the document-title effect and the archived
 * show-state with its auto-expand, plus the selected-period derivation both
 * key on. Split from `LeadForm` only to keep the composition root inside the
 * size standard; bodies and dependency arrays move verbatim.
 */
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
  // Set document.title to surface the addressed week in the browser
  // tab. Format: "Week 19, May 4-10 - CustomReport". Resolved from the
  // history entry whose reportId matches the loaded section so the label
  // matches the dropdown. Restores the title on unmount.
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
    const range = formatDateRange(start, titleHistoryEntry.periodEnd);
    const previous = document.title;
    document.title = `Week ${week}, ${range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleHistoryEntry]);

  const [showArchivePeriods, setShowArchivePeriods] = useState(false);
  const selectedPeriodId = pinnedReportId || activeReportId || "";
  const selectedHistoryPeriod = history?.find(
    (entry) => entry.reportId === selectedPeriodId && entry.reportId !== "",
  );

  useEffect(() => {
    if (selectedHistoryPeriod?.archived) {
      setShowArchivePeriods(true);
    }
  }, [selectedHistoryPeriod?.reportId, selectedHistoryPeriod?.archived]);

  return { selectedPeriodId, showArchivePeriods, setShowArchivePeriods };
}
