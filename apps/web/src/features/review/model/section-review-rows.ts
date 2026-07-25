import type {
  ReportSectionReadModel,
  SectionReviewView,
  WeeklyReportReadModel,
} from "@customreport/shared";

/** One rendered section's review state for a per-section verdict surface. */
export interface SectionReviewRow {
  readonly reportSectionId: string;
  readonly version: number;
  readonly authorName: string;
  readonly status: ReportSectionReadModel["status"];
  readonly reviews: readonly SectionReviewView[];
  readonly canReview: boolean;
  readonly groupId: string | null;
}

/**
 * Project the live read model's lead sections onto the per-section review rows.
 * Shared by the head dashboard roll-up strip and the in-report review-mode
 * verdict band so both read the same shape from one place.
 * @param leadSections - The leadSections argument.
 */
export function toSectionReviewRows(
  leadSections: WeeklyReportReadModel["leadSections"],
): SectionReviewRow[] {
  return leadSections.map((section) => ({
    reportSectionId: section.reportSectionId,
    version: section.version,
    authorName: section.authorName,
    status: section.status,
    reviews: section.reviews ?? [],
    canReview: section.canReview ?? false,
    groupId: section.groupId ?? null,
  }));
}
