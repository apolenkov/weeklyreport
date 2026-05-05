/**
 * Translate API `reports.myHistory` entries to the `HistoryEntry` shape the
 * existing `LeadHistoryList` component expects.
 *
 * Per CONTEXT.md D-08, date formatting matches the mock display strings
 * exactly so existing E2E tests (`Apr 14-20`, `2 min ago`, ...) keep
 * passing once Phase 20 seed populates the DB with mock-equivalent data.
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

import type { MyHistoryEntry } from '@customreport/shared';

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
  status: 'submitted' | 'draft';
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
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Format a same-month range as `Apr 14-20` and a cross-month range as
 * `Apr 28-May 4`. Uses UTC components so a server-rendered string and a
 * client-rerendered string never disagree on the day of the month.
 */
export function formatDateRange(start: Date, end: Date): string {
  const sMonth = MONTHS[start.getUTCMonth()];
  const sDay = start.getUTCDate();
  const eMonth = MONTHS[end.getUTCMonth()];
  const eDay = end.getUTCDate();

  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${sMonth} ${sDay}-${eDay}`;
  }
  return `${sMonth} ${sDay}-${eMonth} ${eDay}`;
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

  if (diffSec < 60) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;

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
  // Copy in UTC and shift to the nearest Thursday (ISO anchor).
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon = 0, Sun = 6
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  const diffMs = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
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
