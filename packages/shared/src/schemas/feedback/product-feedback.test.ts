import { describe, expect, it } from "vitest";

import {
  feedbackCreateWireSchema,
  normalizeFeedbackPath,
} from "./product-feedback";

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

describe("feedbackCreateWireSchema", () => {
  it("accepts spoofable presentation fields for server-side replacement", () => {
    expect(feedbackCreateWireSchema.parse(validPayload).authorName).toBe(
      "Spoofed Name",
    );
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
        annotations: Array.from({ length: 51 }, () => ({})),
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
});
