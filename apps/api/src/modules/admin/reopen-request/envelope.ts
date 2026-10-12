import type { ReportSectionStatus } from "@weeklyreport/shared";

import type { ReopenRequestRow } from "../admin-shared.js";

export interface ReopenRequestListItem {
  id: string;
  reportSectionId: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requestedBy: { id: string; name: string; email: string };
  reviewedBy: { id: string; name: string; email: string } | null;
  sectionStatus: ReportSectionStatus;
  report: {
    id: string;
    weekLabel: string | null;
    periodStart: string;
    periodEnd: string;
  };
}

export function toReopenRequestListItem(
  row: ReopenRequestRow,
): ReopenRequestListItem {
  return {
    id: row.id,
    reportSectionId: row.reportSectionId,
    reason: row.reason,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    sectionStatus: row.sectionStatus,
    report: {
      id: row.report.id,
      weekLabel: row.report.weekLabel,
      periodStart: row.report.periodStart.toISOString(),
      periodEnd: row.report.periodEnd.toISOString(),
    },
  };
}
