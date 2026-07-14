import type { MyHistoryEntry } from "@customreport/shared";

import { formatDateRange, isoWeekNumber } from "../../report-sections";

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
      const dateRange = formatDateRange(entry.periodStart, entry.periodEnd);
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
    ""
  );
}

export function visibleLeadSlidePeriodOptions({
  options,
  includeArchive,
  selectedReportId,
}: {
  readonly options: readonly LeadSlidePeriodOption[];
  readonly includeArchive: boolean;
  readonly selectedReportId: string;
}): LeadSlidePeriodOption[] {
  if (includeArchive) return [...options];

  const visible = options.filter((option) => !option.archived);
  const selected = options.find(
    (option) => option.reportId === selectedReportId,
  );

  if (!selected?.archived) return visible;
  if (visible.some((option) => option.reportId === selected.reportId)) {
    return visible;
  }

  return [...visible, selected].sort(
    (a, b) => b.periodStart.getTime() - a.periodStart.getTime(),
  );
}
