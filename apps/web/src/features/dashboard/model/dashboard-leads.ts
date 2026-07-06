import type {
  PortfolioProductOverview,
  ReportSectionReadModel,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";
import {
  initialsFromName as sharedInitialsFromName,
  shortNameFromName,
} from "@customreport/shared";

import {
  deriveLeadStatus,
  type LeadStatus,
} from "../../report-sections/model/lead-status";
import { trafficToStageStatus } from "../../report-sections/model/traffic-light";
import type { LeadInfo, ProductStatus, TrafficLight } from "./dashboard";
import {
  countActivityRecords,
  countProductContent,
  countSectionContent,
  productColumnCounts,
} from "./dashboard-counts";

const TRAFFIC_ICON: Record<ProductStatus, string> = {
  "on-track": "✓", // ✓
  blocked: "✕", // ✕
  "at-risk": "!",
};

// Avatar initials via the canonical shared helper (surname-first ФИО), with
// this surface's "??" placeholder for an empty name. The token logic lives once
// in @customreport/shared — see commit 8fd7e8bf, where four hand-cloned copies
// of it diverged and had to be patched in lockstep.
export function initialsFromName(name: string): string {
  return sharedInitialsFromName(name) || "??";
}

// "YYYY-MM-DD" — length of an ISO date-only prefix.
const ISO_DATE_LENGTH = 10;

function isoSubmittedLabel(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, ISO_DATE_LENGTH) : null;
}

function trafficLightsForLeadByName(
  leadName: string,
  portfolio: PortfolioProductOverview[],
): TrafficLight[] {
  return portfolio
    .filter((p) => p.leadNames.includes(leadName))
    .map((p) => p.worstStatus)
    .filter((status): status is NonNullable<typeof status> => status !== null)
    .map((status) => {
      const presentation = trafficToStageStatus(status);
      const productStatus: ProductStatus =
        presentation === "on-track" ||
        presentation === "at-risk" ||
        presentation === "blocked"
          ? presentation
          : "on-track";
      return { status: productStatus, icon: TRAFFIC_ICON[productStatus] };
    });
}

/**
 * Build the per-lead rows for the dashboard leads table, folding in section
 * content counts, derived status, traffic lights, and submission metadata.
 * Extracted from mapDashboardData's "Leads" step.
 */
export function buildLeadInfos(
  review: SubmissionDashboardRow[],
  weeklyReport: WeeklyReportReadModel,
  currentUserId: string | undefined,
): LeadInfo[] {
  const sectionByAuthor = new Map<string, ReportSectionReadModel>();
  for (const section of weeklyReport.leadSections) {
    sectionByAuthor.set(section.authorId, section);
  }

  return review.map((row) => {
    const section = sectionByAuthor.get(row.leadId);
    // "Has the lead started" reads TOTAL content (product + activity); the
    // displayed product column reads only product-parented rows (Q1).
    const totalContentCount = section ? countSectionContent(section) : 0;
    const reportContentCount = section ? countProductContent(section) : 0;
    const status: LeadStatus = section
      ? deriveLeadStatus({
          sectionStatus: section.status,
          contentCount: totalContentCount,
        })
      : "pending";

    // The portfolio overview only carries lead NAMES, so we name-match either way.
    const trafficLights = trafficLightsForLeadByName(
      row.leadName,
      weeklyReport.portfolioOverview,
    );

    const lastActivity = section?.submittedAt
      ? section.submittedAt.toISOString().slice(0, ISO_DATE_LENGTH)
      : status === "pending"
        ? "Not started"
        : "In progress";

    return {
      id: row.leadId,
      initials: initialsFromName(row.leadName),
      // ADR 0006: the leads table shows the short form; the avatar stays 2-letter.
      name: shortNameFromName(row.leadName),
      role: row.role,
      status,
      trafficLights,
      lastActivity,
      isCurrentUser:
        currentUserId !== undefined && row.leadId === currentUserId,
      productCount: row.projectNames.length,
      reportContentCount,
      ...productColumnCounts(section),
      activityCount: section ? countActivityRecords(section) : 0,
      submittedAtLabel: isoSubmittedLabel(section?.submittedAt ?? null),
      reportSectionId: section?.reportSectionId,
    };
  });
}
