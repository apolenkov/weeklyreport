import type { ReportSectionStatus } from "@weeklyreport/shared";

// API has two ReportSectionStatus values (draft, submitted); UI exposes three
// LeadStatus values. 'pending' is presentation-only (no Prisma/Zod equivalent)
// for a draft section with no report content yet.

export type LeadStatus = "submitted" | "draft" | "pending";

export function deriveLeadStatus(context: {
  sectionStatus: ReportSectionStatus;
  contentCount: number;
}): LeadStatus {
  if (context.sectionStatus === "submitted") {
    return "submitted";
  }
  return context.contentCount > 0 ? "draft" : "pending";
}
