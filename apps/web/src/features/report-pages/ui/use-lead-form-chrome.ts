"use client";

import type { MyHistoryEntry } from "@customreport/shared";
import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";
import { useContext, useEffect, useMemo, useState } from "react";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import { SessionContext } from "../../../lib/session-provider";

interface UseLeadFormChromeInput {
  readonly pinnedReportId: string | undefined;
  readonly activeReportId: string | null;
  readonly byPeriodData: { section: { reportId: string } } | undefined;
  readonly history: readonly MyHistoryEntry[] | undefined;
}

// Mirrors the root metadata template (`%s · ${orgName}`); absent organization
// resolves to the canonical tenant-neutral placeholder, never a product brand.
export function useLeadFormChrome({
  pinnedReportId,
  activeReportId,
  byPeriodData,
  history,
}: UseLeadFormChromeInput): {
  selectedPeriodId: string | null;
  showArchivePeriods: boolean;
  setShowArchivePeriods: (next: boolean) => void;
} {
  const titleBrand =
    useContext(SessionContext)?.organization?.fullName ??
    DEFAULT_ORGANIZATION_IDENTITY.fullName;
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
    document.title = `Week ${week}, ${range} · ${titleBrand}`;
    return () => {
      document.title = previous;
    };
  }, [titleHistoryEntry, titleBrand]);

  // Manual archive toggle is paired with the period it was made on; other
  // periods fall back to auto-expand when the selected period is archived.
  const [archiveToggle, setArchiveToggle] = useState<{
    readonly periodId: string;
    readonly value: boolean;
  } | null>(null);
  const selectedPeriodId = pinnedReportId ?? activeReportId ?? null;
  const selectedHistoryPeriod = selectedPeriodId
    ? history?.find((entry) => entry.reportId === selectedPeriodId)
    : undefined;
  const showArchivePeriods =
    archiveToggle !== null && archiveToggle.periodId === selectedPeriodId
      ? archiveToggle.value
      : selectedHistoryPeriod?.archived === true;
  const setShowArchivePeriods = (next: boolean) =>
    setArchiveToggle({ periodId: selectedPeriodId ?? "", value: next });

  return { selectedPeriodId, showArchivePeriods, setShowArchivePeriods };
}
