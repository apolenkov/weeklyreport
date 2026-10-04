// Maps API history entries to HistoryEntry for LeadHistoryList. Date labels
// include the year and use an en dash so periods stay unambiguous at year edges.

import type {
  CompiledHistoryEntry,
  MyHistoryEntry,
} from "@customreport/shared";

import {
  formatDateTime,
  formatPeriodRangeWithYear,
  formatRelativePast,
  formatWeekLabel,
} from "../../../shared/lib/format/format-date";

// History rows use a presentation-only submission state; API payload types stay
// owned by @customreport/shared.
type HistorySubmissionState = "submitted" | "not-submitted" | "unavailable";

export interface HistoryEntry {
  id: string;
  periodId: string;
  href?: string | undefined;
  weekLabel: string;
  dateRange: string;
  status: "submitted" | "draft" | "published" | "reopened" | "archived";
  archived?: boolean | undefined;
  // The period is live again; publishedAt names the last publication.
  reopened?: boolean | undefined;
  submissionState: HistorySubmissionState;
  submittedAt: string | null;
  submittedAtTitle?: string | null | undefined;
  publishedAt?: string | null | undefined;
  publishedAtTitle?: string | null | undefined;
  createdAt: string | null;
  createdAtTitle?: string | null | undefined;
  lastEditAt: string | null;
  lastEditAtTitle?: string | null | undefined;
  trafficLights: { green: number; yellow: number; red: number };
  itemCount: number;
  riskCount: number;
  decisionCount: number;
  priorityCount: number;
  productCount?: number | undefined;
}

function formatHistoryTimestamp(
  value: Date | null | undefined,
  now: Date,
): string | null {
  return value == null ? null : formatRelativePast(value, now, "long");
}

export function mapHistoryEntries(
  api: readonly MyHistoryEntry[],
  now: Date = new Date(),
): readonly HistoryEntry[] {
  return api.map((e) => ({
    id: e.sectionId,
    // API has no separate periodId; report id routes the read-only history page.
    periodId: e.reportId,
    weekLabel: formatWeekLabel(e.periodStart),
    dateRange: formatPeriodRangeWithYear(e.periodStart, e.periodEnd),
    // A reopened period's draft section reads "Reopened", as in compiled history.
    status:
      e.reopened && e.sectionStatus === "draft" ? "reopened" : e.sectionStatus,
    archived: e.archived ?? false,
    reopened: e.reopened,
    submissionState:
      e.submittedAt !== null
        ? "submitted"
        : e.sectionStatus === "draft"
          ? "not-submitted"
          : "unavailable",
    submittedAt: formatHistoryTimestamp(e.submittedAt, now),
    submittedAtTitle: e.submittedAt ? formatDateTime(e.submittedAt) : null,
    publishedAt: formatHistoryTimestamp(e.publishedAt, now),
    publishedAtTitle: e.publishedAt ? formatDateTime(e.publishedAt) : null,
    createdAt: formatHistoryTimestamp(e.createdAt, now),
    createdAtTitle: e.createdAt ? formatDateTime(e.createdAt) : null,
    lastEditAt: formatHistoryTimestamp(e.lastEditAt ?? e.updatedAt, now),
    lastEditAtTitle:
      (e.lastEditAt ?? e.updatedAt)
        ? formatDateTime(e.lastEditAt ?? e.updatedAt)
        : null,
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
): readonly HistoryEntry[] {
  return api.map((e) => ({
    id: e.reportId,
    periodId: e.reportId,
    href: `/reports/${encodeURIComponent(e.reportId)}`,
    weekLabel: formatWeekLabel(e.periodStart),
    dateRange: formatPeriodRangeWithYear(e.periodStart, e.periodEnd),
    status: e.archived ? "archived" : e.reopened ? "reopened" : "published",
    archived: e.archived,
    reopened: e.reopened,
    submissionState: "unavailable",
    submittedAt: null,
    submittedAtTitle: null,
    publishedAt: formatHistoryTimestamp(e.publishedAt, now),
    publishedAtTitle: formatDateTime(e.publishedAt),
    createdAt: null,
    createdAtTitle: null,
    lastEditAt: null,
    lastEditAtTitle: null,
    trafficLights: e.trafficLights,
    itemCount: e.itemCount,
    riskCount: e.riskCount,
    decisionCount: e.decisionCount,
    priorityCount: e.priorityCount,
    productCount: e.productCount,
  }));
}
