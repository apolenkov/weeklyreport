// Maps API history entries to HistoryEntry for LeadHistoryList. Date labels
// include the year and use an en dash so periods stay unambiguous at year edges.

import type {
  CompiledHistoryEntry,
  MyHistoryEntry,
} from "@customreport/shared";

import {
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
  publishedAt?: string | null | undefined;
  createdAt: string | null;
  lastEditAt: string | null;
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
    publishedAt: formatHistoryTimestamp(e.publishedAt, now),
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
