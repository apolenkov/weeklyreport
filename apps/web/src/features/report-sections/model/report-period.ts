import type { PeriodState } from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
} from "../../../shared/lib/format/format-date";
import type { ReportPeriod } from "./types";

// Navigation-only shape: these lists offer no fill-from and no submission
// marker, so sourceSectionId and isSubmitted stay ABSENT rather than being
// fabricated as "" / true (the ReportPeriod type marks both optional; the
// period-navigator's `leadSubmittedAt` is the only submission source).
export function toNavigationPeriod(args: {
  readonly id: string;
  readonly periodStart: Date | string;
  readonly periodEnd: Date | string;
  readonly archived: boolean;
  readonly isCurrent: boolean;
  readonly periodState?: PeriodState | undefined;
}): ReportPeriod {
  return {
    id: args.id,
    periodStart:
      args.periodStart instanceof Date
        ? args.periodStart
        : new Date(args.periodStart),
    weekLabel: formatWeekLabel(args.periodStart),
    dateRange: formatPeriodRangeWithYear(args.periodStart, args.periodEnd),
    archived: args.archived,
    isCurrent: args.isCurrent,
    ...(args.periodState === undefined
      ? {}
      : { periodState: args.periodState }),
  };
}
