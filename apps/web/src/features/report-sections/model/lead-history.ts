/**
 * Translate API `reports.myHistory` entries to the `HistoryEntry` shape the
 * `LeadHistoryList` component expects.
 *
 * Date formatting includes the year and uses an en dash so period labels
 * stay unambiguous around year boundaries.
 */

import type {
  CompiledHistoryEntry,
  MyHistoryEntry,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatRelativePast,
  isoWeekNumber,
} from "../../../lib/format-date";

// ---------------------------------------------------------------------------
// Self-contained presentation type (mirrors the mock's `HistoryEntry` shape).
// Re-declared here per the self-contained mapper-modules convention, so
// consumers depend on this barrel rather than `mock-data.ts`.
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
  // Prefix the metric line with the lead's assigned-product count for that
  // period when available.
  productCount?: number;
}

// ---------------------------------------------------------------------------
// Helpers (pure, fully unit-testable -- no I/O, no React)
// ---------------------------------------------------------------------------

function formatHistoryTimestamp(
  value: Date | null | undefined,
  now: Date,
): string | null {
  return value == null ? null : formatRelativePast(value, now, "long");
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
    // for routing purposes. This is acceptable for the read-only history page.
    periodId: e.reportId,
    weekLabel: `Week ${isoWeekNumber(e.periodStart)}`,
    dateRange: formatPeriodRangeWithYear(e.periodStart, e.periodEnd),
    status: e.sectionStatus,
    archived: e.archived ?? false,
    submittedAt: formatHistoryTimestamp(e.submittedAt, now),
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
    dateRange: formatPeriodRangeWithYear(e.periodStart, e.periodEnd),
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
