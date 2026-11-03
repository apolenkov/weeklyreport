// Review, acknowledgement, and archive behavior through the page harness.

import { vi } from "vitest";

// Mock toast so we can assert success/error feedback.
const toastSuccess = vi.fn();
const toastError = vi.fn();

import { makeWeeklyReportData } from "./__tests__/weekly-report-page-harness";

const REVIEW_COMMENT_TEXT = "Please double-check the milestone date";

// A live open period whose section the caller may review, mirroring the
// server-stamped `canReview` a head/designated reviewer receives. The reviewer
// comment makes the read-only vs review-mode split observable.
function makeReviewableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeWeeklyReportData("open");
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      version: 1,
      reviews: [],
      canReview: true,
      // No group id keeps the per-group Acknowledge bar inert; the review-mode
      // split under test is independent of acknowledgement.
      groupId: null,
      items: section.items.map((item) => ({
        ...item,
        comments: [
          {
            id: "44444444-4444-4444-8444-aaaaaaaaaa01",
            reviewerId: "head-user-id",
            reviewerName: "Test User",
            text: REVIEW_COMMENT_TEXT,
            createdAt: new Date("2026-04-15T10:00:00Z"),
          },
        ],
      })),
    })),
  };
}

function makeDraftOnlyReviewableData(): ReturnType<
  typeof makeWeeklyReportData
> {
  const base = makeReviewableData();
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      status: "draft" as const,
      submittedAt: null,
    })),
  };
}

function makeMixedReviewableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeReviewableData();
  const submittedSection = base.leadSections.at(0);
  if (!submittedSection) {
    throw new Error("Expected a reviewable section fixture");
  }
  const draftSection = {
    ...submittedSection,
    reportSectionId: "22222222-2222-4222-8222-bbbbbbbbbbb2",
    authorId: "11111111-1111-4111-8111-bbbbbbbbbbbb",
    authorName: "Bob",
    status: "draft" as const,
    submittedAt: null,
  };
  return { ...base, leadSections: [...base.leadSections, draftSection] };
}
export {
  makeDraftOnlyReviewableData,
  makeMixedReviewableData,
  makeReviewableData,
  REVIEW_COMMENT_TEXT,
  toastError,
  toastSuccess,
};

function makeAcknowledgeableData(): ReturnType<typeof makeWeeklyReportData> {
  const base = makeReviewableData();
  return {
    ...base,
    leadSections: base.leadSections.map((section) => ({
      ...section,
      groupId: "99999999-9999-4999-8999-999999999901",
      groupName: "Software Development",
    })),
  };
}
export { makeAcknowledgeableData };
