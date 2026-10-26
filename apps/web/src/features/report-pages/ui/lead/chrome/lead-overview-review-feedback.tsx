import type { ReportSectionReadModel } from "@weeklyreport/shared";

import { mapLeadReviewFeedback } from "../../../../report-sections";
import { LeadReviewFeedback } from "../../../../review";

export function LeadOverviewReviewFeedback({
  section,
  placement,
}: {
  readonly section: ReportSectionReadModel;
  readonly placement: "priority" | "support";
}) {
  const changesRequested = section.reviews.some(
    (review) => review.isCurrent && review.verdict === "changes_requested",
  );
  if (changesRequested !== (placement === "priority")) return null;
  return (
    <LeadReviewFeedback
      records={mapLeadReviewFeedback(section)}
      reviews={section.reviews}
    />
  );
}
