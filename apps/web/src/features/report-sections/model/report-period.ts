import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
} from "../../../lib/format-date";
import type { ReportPeriod } from "./types";

// Navigation-only shape: these lists offer no fill-from and no submission
// marker, so sourceSectionId carries no section identity and isSubmitted is
// constant (period-navigator's `leadSubmittedAt` is the marker's only source).
export function toNavigationPeriod(args: {
  readonly id: string;
  readonly periodStart: Date | string;
  readonly periodEnd: Date | string;
  readonly archived: boolean;
  readonly isCurrent: boolean;
}): ReportPeriod {
  return {
    id: args.id,
    weekLabel: formatWeekLabel(args.periodStart),
    dateRange: formatPeriodRangeWithYear(args.periodStart, args.periodEnd),
    archived: args.archived,
    sourceSectionId: "",
    isCurrent: args.isCurrent,
    isSubmitted: true,
  };
}
