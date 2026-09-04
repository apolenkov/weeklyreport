import { describe, expect, it } from "vitest";

import {
  feedbackResponseSchema,
  MAX_FEEDBACK_ANNOTATIONS,
  MAX_FEEDBACK_PAGE_SCOPE_LENGTH,
  normalizeFeedbackPath,
  pageFeedbackCreateSchema,
} from "./product-feedback";

const responseAnnotation = {
  cssSelector: "[data-feedback-anchor='summary']",
  xpath: "//*[@data-feedback-anchor='summary']",
  textSnippet: "Summary",
  elementTag: "section",
  textPrefix: "",
  textSuffix: "",
  fingerprint: "summary",
  neighborText: "",
  anchorKey: "summary",
  xPct: 0.1,
  yPct: 0.2,
  wPct: 0.3,
  hPct: 0.4,
  scrollX: 0,
  scrollY: 120,
  viewportW: 1440,
  viewportH: 900,
  devicePixelRatio: 2,
  id: "annotation-1",
  feedbackId: "feedback-1",
  createdAt: "2026-09-03T08:00:00.000Z",
} as const;

const validResponse = {
  id: "feedback-1",
  projectName: "weekly-report",
  type: "bug",
  message: "Page comment",
  status: "open",
  url: "/lead/report",
  urlPattern: null,
  viewport: "1440x900",
  userAgent: "test-browser",
  authorName: "Lead User",
  authorEmail: "lead@example.test",
  authorUserId: "lead-1",
  authorReportingGroupId: "group-1",
  resolvedAt: null,
  createdAt: "2026-09-03T08:00:00.000Z",
  updatedAt: "2026-09-03T08:00:00.000Z",
  annotations: [],
  screenshotUrl: null,
  screenshotRegion: null,
  diagnostics: null,
} as const;

describe("normalizeFeedbackPath", () => {
  it("drops origin, query, and fragment", () => {
    expect(
      normalizeFeedbackPath(
        "https://reports.example.test/reports/123?token=secret#row",
      ),
    ).toBe("/reports/123");
  });

  it("keeps normalized pathnames within the persistence bound", () => {
    expect(normalizeFeedbackPath(`/reports/${"x".repeat(2500)}`)).toHaveLength(
      MAX_FEEDBACK_PAGE_SCOPE_LENGTH,
    );
  });
});

describe("feedbackResponseSchema", () => {
  it("accepts page feedback and the bounded annotation range", () => {
    expect(feedbackResponseSchema.safeParse(validResponse).success).toBe(true);
    expect(
      feedbackResponseSchema.safeParse({
        ...validResponse,
        annotations: [responseAnnotation],
      }).success,
    ).toBe(true);
    expect(
      feedbackResponseSchema.safeParse({
        ...validResponse,
        annotations: Array.from(
          { length: MAX_FEEDBACK_ANNOTATIONS },
          () => responseAnnotation,
        ),
      }).success,
    ).toBe(true);
    expect(
      feedbackResponseSchema.safeParse({
        ...validResponse,
        annotations: Array.from(
          { length: MAX_FEEDBACK_ANNOTATIONS + 1 },
          () => responseAnnotation,
        ),
      }).success,
    ).toBe(false);
  });
});

describe("pageFeedbackCreateSchema", () => {
  const payload = {
    type: "change",
    message: "Make the summary easier to scan",
    url: "/lead/report/123",
    viewport: "1440x900",
    userAgent: "test-browser",
    clientId: "page_123",
  } as const;

  it("accepts the bounded page-only payload", () => {
    expect(pageFeedbackCreateSchema.parse(payload)).toEqual(payload);
  });

  it("rejects client identity and product authority", () => {
    expect(
      pageFeedbackCreateSchema.safeParse({
        ...payload,
        authorUserId: "spoofed-user",
      }).success,
    ).toBe(false);
    expect(
      pageFeedbackCreateSchema.safeParse({
        ...payload,
        projectName: "spoofed-product",
      }).success,
    ).toBe(false);
  });
});
