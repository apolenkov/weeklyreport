import { describe, expect, it } from "vitest";

import {
  type FeedbackRow,
  mapFeedback,
} from "./product-feedback.prisma-support";
import { FeedbackInvalidStatusError } from "./product-feedback.repository";

function feedbackRow(overrides: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: "feedback-1",
    projectName: "weekly-report",
    type: "change",
    message: "Please rename the section heading",
    status: "open",
    url: "/reports/1",
    urlPattern: null,
    screenshotUrl: null,
    screenshotRegion: null,
    diagnostics: null,
    viewport: "1280x720",
    userAgent: "test-agent",
    authorUserId: "user-1",
    authorName: "Lead One",
    authorEmail: "lead-one@example.test",
    authorReportingGroupId: "group-1",
    clientId: "client-feedback-1",
    resolvedAt: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
    annotations: [],
    ...overrides,
  };
}

describe("mapFeedback enum boundary", () => {
  it("maps a row whose type and status are shared enum values unchanged", () => {
    const record = mapFeedback(
      feedbackRow({ type: "bug", status: "in_progress" }),
    );

    expect(record).toMatchObject({ id: "feedback-1", type: "bug" });
    expect(record.status).toBe("in_progress");
  });

  it("rejects a stored type outside the shared feedback types", () => {
    expect(() =>
      mapFeedback(feedbackRow({ type: "invalid_category" })),
    ).toThrow(FeedbackInvalidStatusError);
    expect(() =>
      mapFeedback(feedbackRow({ type: "invalid_category" })),
    ).toThrow(/feedback-1/);
  });

  it("rejects a stored status outside the shared feedback statuses", () => {
    expect(() =>
      mapFeedback(feedbackRow({ status: "unknown_status" })),
    ).toThrow(FeedbackInvalidStatusError);
    expect(() =>
      mapFeedback(feedbackRow({ status: "unknown_status" })),
    ).toThrow(/feedback-1/);
  });
});
