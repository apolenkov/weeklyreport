import type { MyHistoryEntry } from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../shared/lib/format/format-date";

export interface LeadSlidePeriodOption {
  readonly reportId: string;
  readonly sectionId: string;
  readonly label: string;
  readonly weekLabel: string;
  readonly dateRange: string;
  readonly periodStart: Date;
  readonly archived: boolean;
  readonly current: boolean;
  readonly submitted: boolean;
}

export function buildLeadSlidePeriodOptions(
  history: readonly MyHistoryEntry[],
  activeReportId: string | null,
): LeadSlidePeriodOption[] {
  return [...history]
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
    .map((entry) => {
      const periodLabel = `Period ${isoWeekNumber(entry.periodStart)}`;
      const dateRange = formatPeriodRangeWithYear(
        entry.periodStart,
        entry.periodEnd,
      );
      const current =
        activeReportId !== null && entry.reportId === activeReportId;
      const archived = entry.archived ?? false;
      const suffix = current ? " (Current)" : archived ? " (Archived)" : "";

      return {
        reportId: entry.reportId,
        sectionId: entry.sectionId,
        label: `${periodLabel} - ${dateRange}${suffix}`,
        weekLabel: periodLabel,
        dateRange,
        periodStart: entry.periodStart,
        archived,
        current,
        submitted: entry.sectionStatus === "submitted",
      };
    });
}

// Empty sentinel disables slide queries when history has no report.
const NO_LEAD_SLIDE_REPORT_ID = "";

export function resolveLeadSlideReportId({
  options,
  requestedReportId,
  activeReportId,
}: {
  readonly options: readonly LeadSlidePeriodOption[];
  readonly requestedReportId: string | null;
  readonly activeReportId: string | null;
}): string {
  if (
    requestedReportId &&
    options.some((option) => option.reportId === requestedReportId)
  ) {
    return requestedReportId;
  }

  if (
    activeReportId &&
    options.some((option) => option.reportId === activeReportId)
  ) {
    return activeReportId;
  }

  return (
    options.find((option) => !option.archived)?.reportId ??
    options.at(0)?.reportId ??
    NO_LEAD_SLIDE_REPORT_ID
  );
}
