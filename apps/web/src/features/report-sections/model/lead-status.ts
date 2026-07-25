// API has two ReportSectionStatus values (draft, submitted); UI exposes three
// LeadStatus values. 'pending' is presentation-only (no Prisma/Zod equivalent)
// for a draft section with no report content yet.

export type ReportSectionStatus = "draft" | "submitted";
export type LeadStatus = "submitted" | "draft" | "pending";

/**
 * Derive Lead Status.
 * @param context - The context argument.
 */
export function deriveLeadStatus(context: {
  sectionStatus: ReportSectionStatus;
  contentCount: number;
}): LeadStatus {
  if (context.sectionStatus === "submitted") {
    return "submitted";
  }
  return context.contentCount > 0 ? "draft" : "pending";
}
