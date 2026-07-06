/**
 * Translate API `reports.myHistory` entries to the `HistoryEntry` shape the
 * `LeadHistoryList` component expects.
 *
 * D17: date formatting includes the year and uses an en dash so period labels
 * stay unambiguous around year boundaries.
 */

import type {
  CompiledHistoryEntry,
  MyHistoryEntry,
} from "@customreport/shared";
import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatTimestampShort,
  isoWeekNumber as sharedIsoWeekNumber,
} from "../../../lib/format-date";

// ---------------------------------------------------------------------------
// Self-contained presentation type (mirrors the mock's `HistoryEntry` shape).
// Re-declared here per the "self-contained mapper modules" decision in
// STATE.md, so consumers depend on this barrel rather than `mock-data.ts`.
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  id: string;
  periodId: string;
  href?: string;
  weekLabel: string;
  dateRange: string;
  status: "submitted" | "draft" | "published" | "archived";
  archived?: boolean;
  submittedAt: string | null;
  publishedAt?: string | null;
  createdAt: string | null;
  lastEditAt: string | null;
  trafficLights: { green: number; yellow: number; red: number };
  itemCount: number;
  riskCount: number;
  decisionCount: number;
  priorityCount: number;
  // HIST-4 (Phase 33-04): prefix the metric line with the lead's
  // assigned-product count for that period when available.
  productCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers (pure, fully unit-testable -- no I/O, no React)
// ---------------------------------------------------------------------------

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
  const diffSec = Math.floor(diffMs / MS_PER_SECOND);

  if (diffSec < SECONDS_PER_MINUTE) return "just now";

  const diffMin = Math.floor(diffSec / SECONDS_PER_MINUTE);
  if (diffMin < MINUTES_PER_HOUR) return `${diffMin} min ago`;

  const diffHour = Math.floor(diffMin / MINUTES_PER_HOUR);
  if (diffHour < HOURS_PER_DAY)
    return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`;

  // Older than a day: short month/day in UTC.
  return formatTimestampShort(submittedAt);
}

function formatHistoryTimestamp(
  value: Date | null | undefined,
  now: Date,
): string | null {
  return formatSubmittedAt(value ?? null, now);
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
    archived: e.archived ?? false,
    submittedAt: formatSubmittedAt(e.submittedAt, now),
    createdAt: formatHistoryTimestamp(e.createdAt, now),
    lastEditAt: formatHistoryTimestamp(e.lastEditAt ?? e.updatedAt, now),
    trafficLights: e.trafficLights ?? { green: 0, yellow: 0, red: 0 },
    itemCount: e.itemCount ?? 0,
    riskCount: e.riskCount ?? 0,
    decisionCount: e.decisionCount ?? 0,
    priorityCount: e.priorityCount ?? 0,
    productCount: e.productCount,
  }));
}

export function mapCompiledHistoryEntries(
  api: readonly CompiledHistoryEntry[],
  now: Date = new Date(),
): HistoryEntry[] {
  return api.map((e) => ({
    id: e.reportId,
    periodId: e.reportId,
    href: `/reports/${encodeURIComponent(e.reportId)}`,
    weekLabel: `Week ${isoWeekNumber(e.periodStart)}`,
    dateRange: formatDateRange(e.periodStart, e.periodEnd),
    status: e.archived ? "archived" : "published",
    archived: e.archived,
    submittedAt: null,
    publishedAt: formatHistoryTimestamp(e.publishedAt, now),
    createdAt: null,
    lastEditAt: null,
    trafficLights: e.trafficLights,
    itemCount: e.itemCount,
    riskCount: e.riskCount,
    decisionCount: e.decisionCount,
    priorityCount: e.priorityCount,
    productCount: e.productCount,
  }));
}
