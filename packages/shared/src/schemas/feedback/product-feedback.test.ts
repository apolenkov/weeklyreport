import { describe, expect, it } from "vitest";

import {
  feedbackCreateWireSchema,
  feedbackResponseSchema,
  MAX_FEEDBACK_ANNOTATIONS,
  MAX_FEEDBACK_PAGE_SCOPE_LENGTH,
  normalizeFeedbackPath,
} from "./product-feedback";

const annotation = {
  anchor: {
    cssSelector: "[data-feedback-anchor='summary']",
    xpath: "//*[@data-feedback-anchor='summary']",
    textSnippet: "Summary",
    elementTag: "section",
    textPrefix: "",
    textSuffix: "",
    fingerprint: "summary",
    neighborText: "",
    anchorKey: "summary",
  },
  rect: { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 },
  scrollX: 0,
  scrollY: 120,
  viewportW: 1440,
  viewportH: 900,
  devicePixelRatio: 2,
} as const;

const validPayload = {
  projectName: "spoofed-product",
  type: "bug",
  message: "The total is difficult to read",
  url: "/reports/123?token=secret#row",
  viewport: "1440x900",
  userAgent: "test-browser",
  authorName: "Spoofed Name",
  authorEmail: "spoofed@example.com",
  clientId: "feedback_123",
  annotations: [],
} as const;

const responseAnnotation = {
  ...annotation.anchor,
  ...annotation.rect,
  scrollX: annotation.scrollX,
  scrollY: annotation.scrollY,
  viewportW: annotation.viewportW,
  viewportH: annotation.viewportH,
  devicePixelRatio: annotation.devicePixelRatio,
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

describe("feedbackCreateWireSchema", () => {
  it("accepts spoofable presentation fields for server-side replacement", () => {
    expect(feedbackCreateWireSchema.parse(validPayload).authorName).toBe(
      "Spoofed Name",
    );
  });

  it("accepts honest page feedback without a fabricated annotation", () => {
    const parsed = feedbackCreateWireSchema.parse(validPayload);

    expect(parsed.annotations).toEqual([]);
  });

  it("accepts one through fifty annotations and rejects a fifty-first", () => {
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        annotations: [annotation],
      }).success,
    ).toBe(true);
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        annotations: Array.from(
          { length: MAX_FEEDBACK_ANNOTATIONS },
          () => annotation,
        ),
      }).success,
    ).toBe(true);
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        annotations: Array.from(
          { length: MAX_FEEDBACK_ANNOTATIONS + 1 },
          () => annotation,
        ),
      }).success,
    ).toBe(false);
  });

  it("accepts bounded screenshot, region, and diagnostics", () => {
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        screenshotDataUrl: "data:image/jpeg;base64,AA==",
        screenshotRegion: { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 },
        diagnostics: {
          console: [
            {
              level: "error",
              timestamp: "2026-09-03T10:00:00.000Z",
              message: "Request failed",
            },
          ],
          network: [
            {
              url: "/api/report",
              method: "GET",
              status: 500,
              durationMs: 42,
              timestamp: "2026-09-03T10:00:00.000Z",
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it("rejects malformed and oversized capture fields", () => {
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        screenshotDataUrl: "https://example.test/image.png",
      }).success,
    ).toBe(false);
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        diagnostics: {
          console: Array.from({ length: 51 }, () => ({
            level: "log",
            timestamp: "now",
            message: "entry",
          })),
          network: [],
        },
      }).success,
    ).toBe(false);
  });

  it("accepts null capture fields when capture fails silently", () => {
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        screenshotDataUrl: null,
        screenshotRegion: null,
        diagnostics: null,
      }).success,
    ).toBe(true);
  });

  it("rejects oversized messages and annotation collections", () => {
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        message: "x".repeat(5001),
      }).success,
    ).toBe(false);
    expect(
      feedbackCreateWireSchema.safeParse({
        ...validPayload,
        annotations: Array.from(
          { length: MAX_FEEDBACK_ANNOTATIONS + 1 },
          () => annotation,
        ),
      }).success,
    ).toBe(false);
  });
});

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
