import type {
  ReportSectionReadModel,
  SectionReviewView,
  WeeklyReportReadModel,
} from "@weeklyreport/shared";

export interface SectionReviewRow {
  readonly reportSectionId: string;
  readonly version: number;
  readonly authorName: string;
  readonly status: ReportSectionReadModel["status"];
  readonly reviews: readonly SectionReviewView[];
  readonly canReview: boolean;
  readonly groupId: string | null;
}

export function isSubmittedReviewableSection(
  section: Pick<SectionReviewRow, "status" | "canReview">,
): boolean {
  return section.canReview && section.status === "submitted";
}

// One projection feeds both the head roll-up strip and in-report verdict band.
export function toSectionReviewRows(
  leadSections: WeeklyReportReadModel["leadSections"],
): SectionReviewRow[] {
  return leadSections.map((section) => ({
    reportSectionId: section.reportSectionId,
    version: section.version,
    authorName: section.authorName,
    status: section.status,
    reviews: section.reviews,
    canReview: section.canReview ?? false,
    groupId: section.groupId ?? null,
  }));
}
