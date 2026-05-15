/**
 * Translate API `reports.myHistory` entries to the `HistoryEntry` shape the
 * existing `LeadHistoryList` component expects.
 *
 * D17: date formatting includes the year and uses an en dash so period labels
 * stay unambiguous around year boundaries.
 *
 * NOTE: The current `myHistory` router output (see
 * `packages/shared/src/schemas/report.ts -> myHistoryEntrySchema`) does
 * NOT yet expose `weekLabel`, `trafficLights`, `itemCount`, `riskCount`,
 * or `decisionCount`. For this proof-of-life migration:
 *  - `weekLabel` is computed from `periodStart` (ISO week number).
 *  - `trafficLights`/counts default to zero.
 * Extending the router to project these aggregates is deferred to a
 * follow-up plan (out of scope for the smallest-container proof-of-life).
 */

import type { MyHistoryEntry } from "@customreport/shared";
import {
  formatPeriodRangeWithYear,
  isoWeekNumber as sharedIsoWeekNumber,
} from "../format-date";

// ---------------------------------------------------------------------------
// Self-contained presentation type (mirrors the mock's `HistoryEntry` shape).
// Re-declared here per the "self-contained mapper modules" decision in
// STATE.md, so consumers depend on this barrel rather than `mock-data.ts`.
// ---------------------------------------------------------------------------

export type HistoryEntry = {
  id: string;
  periodId: string;
  weekLabel: string;
  dateRange: string;
  status: "submitted" | "draft";
  submittedAt: string | null;
  trafficLights: { green: number; yellow: number; red: number };
  itemCount: number;
  riskCount: number;
  decisionCount: number;
  // HIST-4 (Phase 33-04): mockup s9 prefixes the metric line with the lead's
  // assigned-product count for that period. Optional because the API endpoint
  // doesn't always populate it (history aggregator vs the carry-over view).
  productCount?: number;
};

// ---------------------------------------------------------------------------
// Helpers (pure, fully unit-testable -- no I/O, no React)
// ---------------------------------------------------------------------------

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatDateRange(start: Date, end: Date): string {
  return formatPeriodRangeWithYear(start, end);
}

/**
 * Format a submission timestamp into a relative or short-form string:
 *  - null               -> null (passthrough; component renders "no submitted line")
 *  - <60s               -> 'just now'
 *  - <60min             -> 'N min ago'
 *  - <24h               -> 'N hour ago' / 'N hours ago'
 *  - older              -> 'Apr 18' (UTC components)
 */
export function formatSubmittedAt(
  submittedAt: Date | null,
  now: Date = new Date(),
): string | null {
  if (submittedAt === null) return null;

  const diffMs = now.getTime() - submittedAt.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24)
    return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;

  // Older than a day: short month/day in UTC.
  const month = MONTHS[submittedAt.getUTCMonth()];
  const day = submittedAt.getUTCDate();
  return `${month} ${day}`;
}

/**
 * Standard ISO 8601 week number (Mon-anchored), computed against UTC components
 * so the result is timezone-stable.
 */
export function isoWeekNumber(d: Date): number {
  return sharedIsoWeekNumber(d);
}

// ---------------------------------------------------------------------------
// Composite mapper
// ---------------------------------------------------------------------------

/**
 * Map API `MyHistoryEntry[]` to the presentation `HistoryEntry[]` shape.
 *
 * Defaults stub fields not yet projected by the router (counts, traffic
 * lights). See module JSDoc for follow-up.
 */
export function mapHistoryEntries(
  api: readonly MyHistoryEntry[],
  now: Date = new Date(),
): HistoryEntry[] {
  return api.map((e) => ({
    id: e.sectionId,
    // No separate periodId in the API; the report id identifies the period
    // for routing purposes. This is acceptable for the read-only history
    // page (see plan 21-02, follow-up: extend router to project periodId).
    periodId: e.reportId,
    weekLabel: `Week ${isoWeekNumber(e.periodStart)}`,
    dateRange: formatDateRange(e.periodStart, e.periodEnd),
    status: e.sectionStatus,
    submittedAt: formatSubmittedAt(e.submittedAt, now),
    // Stubbed: not currently exposed by reports.myHistory. Follow-up plan
    // will extend the router with aggregate counts.
    trafficLights: { green: 0, yellow: 0, red: 0 },
    itemCount: 0,
    riskCount: 0,
    decisionCount: 0,
  }));
}
